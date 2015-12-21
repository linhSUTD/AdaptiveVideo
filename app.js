require("./shared.js");

var config          = require('./config');
var express         = require('express');
var passport        = require('passport');
var http            = require('http');
var fs              = require('fs');
var path            = require('path');
var log4js	        = require("log4js");
var domain 		    = require("domain");
var MongoStore      = require('connect-mongo')(express);
var cluster	        = require("cluster");
var util	        = require("util");
var colors	        = require("colors");
var BinaryServer    = require('binaryjs').BinaryServer;
var video           = require('./video');

// Process topology:
// - Master			- main node.js instance, spawns web-servers and worker processes
// - Web-server		- sub-process for handling API and file requests (one per core)
// - Worker			- sub-process for CPU and I/O intensive tasks


// Rootdir must be defined at the top level
ROOTDIR					= __dirname;
MASTER					= cluster.isMaster;				// is this the master server of a cluster?
WEBSERVER				= process.env.isWebServer;		// is this process a web-server? (passed from master process)
AUTOMATION				= process.env.isAutomation;		// is this process a automation thread (passed from master process)



var Database			= require("./server/database.js").Database;



//Pull in the mongo store if we're configured to use it
//else pull in MemoryStore for the session configuration
var sessionStorage;

sessionStorage = new MongoStore({
	db: config.server.mongo.dbName,
	host: config.server.mongo.host,
	port: config.server.mongo.port,
	username: config.server.mongo.user,
	password: config.server.mongo.password,
	collection: config.server.session.collectionName
});

// Use nginx header "x-forwarded-for" as original IP of the request
function fixIP(req, res, next)
{
	if (req.headers['x-forwarded-for'])
	{
		req.ip = req.headers['x-forwarded-for'].split(",")[0];
		req.realIp = req.headers['x-forwarded-for'].split(",")[0];
	}
	next();
}

// Allow OPTIONS requests for CORS
var allowCrossDomain = function(req, res, next)
{
	res.header('Access-Control-Allow-Origin', req.get('origin'));
	res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
//        res.header('Access-Control-Allow-Headers', 'Content-Type');
	res.header('Access-Control-Allow-Headers', 'Content-Type, Content-Range, Content-Disposition');
	res.header('Access-Control-Allow-Credentials', true);

	next();
}

function domainWrapper(req, res, next)
{
	var reqDomain = domain.create();
	reqDomain.on('error', function(err)
	{
		console.error(err);
		console.error("Caught by Domain Wrapper");
		res.statusCode = 500;
		res.end("Internal Error")

		reqDomain.dispose();
	});

	reqDomain.enter();
	next();
}

//======================================================================
// Setup Logger
//======================================================================
log4js.configure({
	appenders: [
		{ type: 'console' },
		{ type: 'file', filename: 'logs/logs.log' }
	],
	replaceConsole: true
});

function handleDebugConsole()
{
	log4js.restoreConsole();
	if (config.DEBUG) console.log.apply(this, arguments);
	log4js.replaceConsole();
	console.debug = handleDebugConsole;
}

console.debug = handleDebugConsole;

// Express configuration
var app = express();
app.set('view engine', 'ejs');
app.use(express.cookieParser());
app.use(express.urlencoded());
app.use(express.json());

//Session Configuration
app.use(express.session({
	secret: config.server.session.secret,
	store: sessionStorage,
	key: "authorization.sid",
	cookie: {maxAge: config.server.session.maxAge },
	maxAge: config.server.session.maxAge
}));

app.use(allowCrossDomain);
app.use(fixIP);

app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);



// Catch all for error messages.  Instead of a stack
// trace, this will log the json of the error message
// to the browser and pass along the status with it
app.use(function (err, req, res, next)
{
	if (err)
	{
		res.status(err.status);
		res.json(err);
	} else
	{
		next();
	}
});
app.use(domainWrapper);

// Passport configuration

// Create our HTTPS server listening on port 3000.
var server = http.createServer(app);

var bs = BinaryServer({server: server, path: '/video-streaming'});

bs.on('connection', function(client){
    client.on('stream', function(stream, meta){

        switch (meta.event) {
            case 'list':
                video.list(stream, meta);
                break;
            case 'request':
                video.request(stream, meta);
                break;
            case 'process':
                video.process(stream, meta);
                break;
            default:
                video.upload(stream, meta);
        }
    })
})

console.log("OAuth 2.0 Authorization Server started on port %d ", config.server.PUBLIC_PORT);

//======================================================================
// Express helper functions for json responses
//======================================================================
http.ServerResponse.prototype.success = function(data)
{
	data = data || {};
	data.success = true;
	this.json(data);
};

//Return 400 HTTP code with a error json message
http.ServerResponse.prototype.error = function(code, err)
{
	// [ 1, "Error message" ]
	if (Array.isArray(code))
	{
		err = code[1];
		code = code[0];
	}
	// { error: "Error message", code: 1 }
	else if (typeof code == "object" && code.error && code.code)
	{
		err = code.error;
		code = code.code;
	}
	// "Error message"
	else if (code && !err) { err = code; code = Errors.Unspecified; }
	// Or "code" and "err" provided separately as arguments


	var msg = err || ""; //util.format.apply(this, arguments);
	if(config.server.DEBUG)
	{
		console.debug((err && err.stack) || msg)
	}
	else
	{
		console.log(msg)
	}
	if(msg.toString().indexOf("Error: ER") != -1)
	{
		msg = config.server.DEBUG ? msg : "Invalid Request";
		code = 400;
	}
	this.status(400);
	this.json({ error: msg.toString(), errorCode: code });
};


http.IncomingMessage.prototype.ensureParam = function(name, type, optional)
{
	var val = this.param(name);
	if (!optional && (val === null || val === undefined || val === "")) throw "Non-optional paramater '"+name+"' is missing";
	if (type && val != null)
	{
		var t = type.toLowerCase();
		if (t == "array")
		{
			if (!Array.isArray(val)) throw "Paramater '"+name+"' is expected to be of type Array";
		}
		else
		if (typeof val != t) throw "Parameter '"+name+"' is expected to be of type "+type;
	}
	return val;
}


/**
 * Handling of critical system level errors an administrators needs to be notified of
 * By default and an e-mail to the admin and print error to the console
 * @param err
 */
var criticalError = function(err)
{
	console.trace(err);
};

//======================================================================
// The responsibility of the master server is to spawn child web-server processes
// as well as worker process that will take care of CPU and I/O expensive tasks, and
// further monitor their execution, restarting when necessary
//======================================================================
if (MASTER)
{
	console.log("======================================");
	console.log("========= Server is starting =========");
	console.log("======================================");

	var numCPUs = require("os").cpus().length;


	function spawnWebServerProcess()
	{
		var worker = cluster.fork({ isWebServer: true });
		worker.isWebServer = true;

		worker.on("exit", function(worker, code, signal)
		{
			criticalError(util.format("Web server process %d died, code: %s. Restarting...", 0, code)); //TODO: Find a way to access worker.process.pid
			spawnWebServerProcess();
		});

		worker.on("message", function(msg)
		{
			console.log(util.format("Web server process: %s", msg));
		});
	}

	function spawnAutomationProcess()
	{
		var worker = cluster.fork({ isAutomation: true });
		worker.isWebServer = true;

		worker.on("exit", function(worker, code, signal)
		{
			//criticalError(util.format("Worker process %d died, code: %s. Restarting...", worker.process.pid, code));
			criticalError(util.format("Automation process died, code: %s. signal: %s. Restarting...", code, signal));
			spawnAutomationProcess();
		});

		worker.on("message", function(msg)
		{
			console.log(util.format("Automation process: %s", msg));
		});
	}


	//Make sure the database schema is up to date before launching children processes
	Database.initializeDatabase(function(err)
	{
		if (err)
		{
			criticalError("Error when initializing connection with database: "+err);
			process.exit(1);
			return;
		}

		// spawn web-servers
		for (var i=0; i<numCPUs - 1; i++)
			spawnWebServerProcess();

		//spawnAutomationProcess();


	});
}
else
//======================================================================
// Web-server's responsibility is to provide APIs to public and host static files
// Expensive requests should be forwarded to the worker thread instead
//======================================================================
{
	if (WEBSERVER)
		console.log("Web server process started".magenta);

	if (AUTOMATION)
		console.log("Automation process started".magenta);




	Database.init(function(err)
	{
		if (err)
		{
			criticalError("Error when initializing connection with database: "+err);
			process.exit(1);
			return;
		}

		// 2) Web-server hosts static files and serves APIs
		if (WEBSERVER)
		{
			// launch web-server
			//API.init(app);
			//app.use(handleRequestError);

            app.use(express.static(path.join(__dirname, 'public')));

            server.listen(config.server.PUBLIC_PORT, function()
			{
				console.log("Web server process listening on %s:%d ", "localhost",  config.server.PUBLIC_PORT);
			});

		}
	});
}




