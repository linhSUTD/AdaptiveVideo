var config 		= require('./../config');
var mysql		= require("mysql");
var queues		= require("mysql-queues");
var async		= require("async");

var DatabaseSchema		= require("./database-schema.js").DatabaseSchema;

SystemUser = null;					// in audit trail, when change was done by the system

/**
 * MySQL database handling object
 */
var Database = new (function()
{
	var self = this;
	var db = this.db = null;
	var ShadowPrefix = "Archive_";			// prefix added to shadowed tables
	var IPlogTablePrefix = "IPlog_";		// e.g. IPlog_2013_03
	var pool;								// connection pool
	var poolConnectionsCount = ((Math.random() * 100)|0) * 1000;

	var InsertArchiveData = config.server.database.ensureArchiveData;		// make sure there is always an archive entry for each item in main tables
	var BuildContraints = config.server.database.ensureContraints;			// create new constraints
	var BuildTriggers = config.server.database.ensureTriggers;				// recreate triggers (drop and create new)
	var CreateSchema = BuildContraints || BuildTriggers || config.server.database.ensureSchema;
	var InsertData = config.server.database.ensureData;

	// This remark will be put under user subscriptions going inactive when user is being suspended.
	// It will be used later hen the user gets reactivated
	var UserTerminationRemark = "Account suspended";

	var reconnectTimer;
	var keepAliveTimer;
	var ReconnectDelay = 5000;


	//TODO: Parameterize all the queries here. Currently uses various techniques for sort, ids, fields, languages (Replace,escape,escapeId)
	/**
	 * Helper class to faciliate complex select query creation, especially with translations
	 * @param from				- from which table
	 * @param alias				- alias of the main object being selected
	 * @param joins				- list of join objects
	 * @param where				- where condition
	 * @param [options]			- additional options (languages, exclude, ids, fields)
	 * @constructor
	 */
	function QueryBuilder(from, alias, joins, where, options)
	{
		where = where || "";
		options = options || {};

		var languages = options.languages || [];
		var fields = options.fields || {};
		for(var i in fields)
		{
			for(var j in fields[i])
			{
				fields[i][j] = fields[i][j].replace(/\W/g, 'a');	//Remove all non alphanumeric characters [A-Za-z0-9_]
			}
		}

		// exlude joins
		var exclude = options.exclude || [];
		var excludeMap = {};
		exclude.map(function(e) { excludeMap[e] = true; });

		// remove joins that are excluded
		joins = joins.filter(function(join)
		{
			if (join.alias && excludeMap[join.alias]) return false;
			return true;
		});

		// required joins (force INNER instead of LEFT)
		var require = options.require || [];
		var requireMap = {};
		require.forEach(function(r) { requireMap[r] = true; });


		var query = "SELECT ";
		//var hasColumns = false;
		var columns = options.columns || [];

		// if none of the joins refer to the main table, add default selector
		if (!joins.filter(function(join) { return join.alias == alias && join.fields.length; }).length)
		{
			columns.push(alias + ".*");
		}

		joins.forEach(function(join)
		{
			// override retrieved fields if necessary
			if (fields[join.alias]) join.fields = fields[join.alias];

			// if not selecting anything, don't join
			if (!join.fields || !join.fields.length) return;

			// is this join required?
			if (requireMap[join.alias]) join.type = "INNER";

			// general columns: item.id, item.publisher_id, item.isbn etc...
			columns = columns.concat(join.fields.map(function(field)
			{
				return join.alias+"."+field;
			}));

			// translation columns: trans_item_title_en, trans_item_description_fr etc...
			if (join.translations)
			{
				// translation specific columns
				var transColumns = getTableColumns(DatabaseSchema.translations[join.table.replace("Archive_", "")]).filter(function(column)
				{
					return column != "ref_id" && column != "id" && column != "code";
				});

				languages.forEach(function(lang)
				{
					lang = lang.replace(/\W/g, 'a');	//Remove all non alphanumeric characters [A-Za-z0-9_]
					transColumns.forEach(function(column)
					{
						columns.push("trans_"+join.alias+"_"+lang+"."+column+" as trans_"+join.alias+"_"+column+"_"+lang.replace(/\W/g, 'a'));
					});
				});
			}
		});

		query += columns.join(",") + "  FROM "+from+" "+alias+" ";		// double whitspace before "FROM" intented! it's used in regex later in executePaginated()

		// add all joins along with translations if necessary
		joins.forEach(function(join)
		{
			if (join.on)
			{
				var type = join.type || "LEFT";
				query += type+" JOIN "+join.table+" "+join.alias+" ON "+join.on;

				// extra ON condition if supplied in options.joinConditions
				if (options.joinConditions && options.joinConditions[join.alias])
					query += " AND "+options.joinConditions[join.alias];

				query += "\n";
			}
			else if (join.sql)
			{
				if (join.type) join.sql = join.sql.replace(/\w+\sJOIN/, join.type+" JOIN");
				query += join.sql+"\n";
			}

			if (join.translations)
			{
				languages.forEach(function(lang)
				{
					lang = lang.replace(/\W/g, 'a');	//Remove all non alphanumeric characters [A-Za-z0-9_]
					query += "LEFT JOIN "+(join.table.replace("Archive_", ""))+"_Translations trans_"+join.alias+"_"+lang+" ON trans_"+join.alias+"_"+lang+".ref_id = "+join.alias+".id AND trans_"+join.alias+"_"+lang+".code = '"+lang+"'\n";
				});
			}
		});

		// limit by ids
		if (options.ids && options.ids.length)
		{
			for(var i in options.ids)
			{
				options.ids[i] = mysql.escape(options.ids[i]);
			}
			where += (where.length ? " AND " : "WHERE ") + alias +".id IN ("+options.ids.join(",")+") ";
		}


		var queryBeforeWhere = query;

		query += " "+where;


		// sort
		if (options.sort && options.sort.field)
		{
			var fields = options.sort.field.split(",");
			for(var i in fields)
			{
				var segments = fields[i].split(".");
				if (segments.length == 1) segments.unshift(alias);
				var segment = segments.join(".");
				segment = mysql.escapeId(segment);
				fields[i] = segment;
				if (options.sort.value == Sort.Asc) fields[i] += " ASC ";
				if (options.sort.value == Sort.Desc) fields[i] += " DESC ";
			}
			var sortField = fields.join(",");
			query += " ORDER BY "+sortField+" ";
			query += ", "+alias+".id ASC ";			// additionally, sort by id, if the original sort values are identical
		}


		config.server.DEBUGQUERIES && console.debug("-----------------------------------------".red);
		config.server.DEBUGQUERIES && console.debug(query.green);
		this.query = query;


		/**
		 * Once the results have been obtained, embed all declared translations first
		 * @param results
		 */
		this.embedTranslations = function(results)
		{
			var joinsWithTranslations = joins.filter(function(join)
			{
				return join.translations;
			});

			// embed translations
			(results.results || results).forEach(function(row)
			{
				joinsWithTranslations.forEach(function(join)
				{
					var table = join.alias;

					var translationColumns = getTableColumns(DatabaseSchema.translations[join.table.replace("Archive_", "")]).filter(function(column)
					{
						return column != "ref_id" && column != "id" && column != "code";
					});

					translationColumns.forEach(function(column)
					{
						if (!row[table]) return;
						row[table][column] = {};

						languages.forEach(function(code)
						{
							row[table][column][code] = row["trans_"+table+"_"+code]["trans_"+table+"_"+column+"_"+code];
						});
					});
				});
			});
		}


		/**
		 * Execute as paginated query
		 * @param values
		 * @param pagination
		 * @param callback
		 */
		this.executePaginated = function(values, pagination, callback)
		{
			var result =
			{
				total:		0,
				offset:		pagination.offset,
				limit:		pagination.limit,
				results:	[]
			};

			function executeCountQuery(next)
			{
				// count unique results that meet specified criteria
				var countQuery = query.replace(/^SELECT.+?\s\sFROM/, "SELECT COUNT(DISTINCT "+alias+".id) AS cnt FROM");

				poolQuery(countQuery, values, function(err, results)
				{
					if (err) return next(err);
					result.total = results[0].cnt;
					next();
				});
			}

			function executeResultsQuery(next)
			{
				// embed current query with WHERE conditions inside the same query but unconditioned as an inner join
				// so that only the distinct results from the inner query are matched
				var innerQuery = query.replace(/^SELECT.+?\s\sFROM/, "SELECT DISTINCT "+alias+".id FROM");
				innerQuery += limit(pagination);

				var outerQuery = queryBeforeWhere + "\nINNER JOIN (" + innerQuery + ") AS __innerQuery ON __innerQuery.id = " + alias + ".id \n";

				poolQuery({ nestTables: true, sql: outerQuery, values: values }, function(err, results)
				{
					if (err) return next(err);
					result.results = results;
					next();
				});
			}

			async.parallel([
				executeCountQuery,
				executeResultsQuery
			], function(err)
			{
				if (err) return callback(err);
				callback(null, result);
			});
		}


		/**
		 * Execute query by using pagination or not, depending on options. The results are always returned
		 * as paginated results object
		 * @param values
		 * @param callback
		 */
		this.execute = function(values, callback)
		{
			if (options.pagination)
			{
				this.executePaginated(values, options.pagination, callback);
			}
			else
			{
				poolQuery({ nestTables: true, sql: query, values: values }, function(err, results)
				{
					if (err) return callback(err);
					callback(null, {
						offset: 	0,
						results:	results
					});
				});
			}
		}
	}




	/**
	 * Initialize the connection to the database, set up handlers, ensure schema
	 * @param callback
	 */
	function init(callback)
	{
		this.open(function(err)
		{
			connectionHandler(err, callback);
		});
	}


	/**
	 * Just open the connection to the database
	 * @param callback
	 */
	function open(callback)
	{
		// create a pool of connections for regular queries
		pool = mysql.createPool({
			host:				config.server.database.host,
			port:				config.server.database.port,
			user:				config.server.database.user,
			password:			config.server.database.password,
			connectionLimit:	config.server.database.poolSize,
			database:			config.server.database.dbName,
			timezone:			config.server.database.timezone,
			waitForConnections:	true
		});

		pool.on("connection", function(conn)
		{
			// assign unique id to this pool connection
			if (typeof conn.id == "undefined") conn.id = poolConnectionsCount++;

			//console.log("NEW CONNECTION: ".red, conn.id);//TODO

			// make sure the Database is being used when reinstating the connection
			conn.query("USE "+config.server.database.dbName);

			// clear the timeout in case of error
			conn.on("error", function(err)
			{
				conn.release();
				clearTimeout(conn.timeout);
			});
		})

		initPoolKeepAliveTimer();

		// create the main connection for the transactions
		// TODO: transacted connections should also belong to the pool, but for the stability's sake
		// for the time being only one connection will be maintained. All transaction queries are
		// stored in one execution queue and run in sequence.
		// The benefit is that different CMS and backend transactions will never intermix
		reconnect(callback);
	}


	/**
	 * To make sure pool connections are not being reset by server do to inactivity,
	 * every 10 minutes or so we must send a small query to refresh it
	 */
	function initPoolKeepAliveTimer()
	{
		clearInterval(keepAliveTimer);
		keepAliveTimer = setInterval(function()
		{
			pool.getConnection(function(err, conn)
			{
				if (err)
				{
					console.error(err);
					conn.release();
					return;
				}

				conn.query("SELECT 1");
				conn.release();
			});

			// Refresh also main db connection
			db.query("SELECT 1");

		}, config.server.constants.keepAliveInterval);
	}


	/**
	 * Try to connect to the database (the transaction connection) and if failed, schedule next attempt
	 * @param callback
	 */
	function reconnect(callback)
	{
		console.log("Reconnecting to the database");
		db = self.db = mysql.createConnection({
			host:				config.server.database.host,
			port:				config.server.database.port,
			user:				config.server.database.user,
			password:			config.server.database.password,
			database:			config.server.database.dbName,
			timezone:			config.server.database.timezone
		});
		queues(db, true);


		function scheduleReconnect(callback)
		{
			clearTimeout(reconnectTimer);
			reconnectTimer = setTimeout(function()
			{
				reconnect(callback);
			}, ReconnectDelay);
		}

		// on error, reconnect
		db.on("error", function(err)
		{
			// ignore non-critical errors
			if (!err.fatal)
				return console.error("Database Error: ", err.code);

			// if connection has been lost, reconnect
			if (err.code == "PROTOCOL_CONNECTION_LOST")
			{
				console.error("Database Error: "+err.code+", reconnecting in a while");
				scheduleReconnect();
				/*db = self.db = mysql.createConnection(config.server.database);
				 queues(db, true);
				 db.connect(function(err)
				 {
				 connectionHandler(err);
				 });*/
			}
			else
			{
				console.error("Fatal Database Error: ", err.code);
			}
		});

		// when connection is closed, reconnect soon
		db.on("close", function (err)
		{
			console.error("SQL connection closed, reconnecting in "+ReconnectDelay+" ms");
			scheduleReconnect();
		});



		db.connect(function(err)
		{
			if (err)
			{
				console.error("Error when connecting to database: "+err+", reconnecting in "+ReconnectDelay+" ms");
				scheduleReconnect(callback);
				return;
			}

			console.log("Connected to the database");


			function setTimezone(next)
			{
				db.query("SET time_zone = '+00:00'", next);
			}

			async.series([
				setTimezone
			], callback);
		});
	}


	/**
	 * Close all connections
	 */
	function close(callback)
	{
		clearInterval(keepAliveTimer);
		db.destroy();
		pool.end();
		callback && callback();
	}


	/**
	 * Get DB Connection from the pool
	 * @param callback
	 */
	function getConnection(callback)
	{
		pool.getConnection(function(err, db)
		{
			if (err)
			{
				console.error("Error: No pool connection available");
				return callback(err, db);
			}

			if (db.timeout)
			{
				console.error("Pool connection %d was with uncleared timeout", db.id);
				clearTimeout(db.timeout);
			}


			// create a timeout, so that if the connection is not returned to the pool after certain amount of time,
			// it will be forcible reclaimed
			db.timeout = setTimeout(function()
			{
				if (db)
				{
					console.error("Pool connection %d was not returned to the pool. Reclaiming forcibly.", db.id);
					db.release();
				}
			}, config.server.constants.poolIdleTimeout);

			// whenever release() is called on connection, clear the timeout
			if (!db._release)
			{
				db._release = db.release;
				db.release = function (cb)
				{
					clearTimeout(db.timeout);
					delete db.timeout;
					pool.releaseConnection(db);
					if (cb) cb();
				}
			}

			callback(err, db);
		});
	}


	/**
	 * Reconnect to the database upon error
	 * @param err
	 * @param callback
	 */
	function connectionHandler(err, callback)
	{
		if (err)
		{
			criticalError("Error when connecting to database: "+err+", reconnecting in "+ReconnectDelay+" ms");

			reconnectTimer = setTimeout(function()
			{
				reconnect(callback);
			}, ReconnectDelay);

			return;		// don't call callback
		}

		async.series([
			useDatabase,
			getConfiguration
		], callback);
	}


	/**
	 * Execute use database query on the main connection
	 * @param next
	 */
	function useDatabase(next)
	{
		db.query("USE "+config.server.database.dbName, next);
	}


	/**
	 * Ensure schema, procedures if necessary, called only by the master process
	 * @param callback
	 */
	function initializeDatabase(callback)
	{
		console.log("Initializing database...");
		async.series([
			open,
			ensureProcedures,		// ensure critical procedures
			ensureSchema,			// ensure schema of the database is correct
			initData,				// put some initial data that needs to be there (if doesn't exist yet)
			close
		], callback);
	}


	/**
	 * Insert default data into database if doesn't already exist
	 * @param callback
	 */
	function initData(callback)
	{
		if (!InsertData) return callback && callback();

		console.debug("Initializing data");

		function insertDefaultLanguage(next)
		{
			var query =	"INSERT IGNORE INTO Languages (title, code) VALUES ('English', 'en')";
			db.query(query, next);
		}

		function insertArchiveData(next)
		{
			if (!InsertArchiveData) return next();

			var tasks = [];
			console.log("Inserting archive data");

			Object.keys(DatabaseSchema.shadowed).forEach(function(name, i)
			{
				var definition = DatabaseSchema.shadowed[name];

				function checkTable(next)
				{
					db.query("SELECT o.* FROM "+name+" o LEFT JOIN "+ShadowPrefix+name+" a ON o.id = a.id WHERE a.id IS NULL", function(err, results)
					{
						if (err) return next(err);

						if (results.length == 0) return next();

						console.log("Results from table "+name+" not archived yet: ", results);

						var keys = Object.keys(results[0]);
						var values = [];
						var placeholders = results.map(function(item)
						{
							return "("+keys.map(function(key)
							{
								var val = item[key];
								values.push(val);
								return "?";
							}).join(",")+")";
						}).join(",");

						db.query("INSERT INTO "+ShadowPrefix+name+" ("+keys.join(",")+") VALUES "+placeholders, values, next);
					});
				}

				tasks.push(checkTable);
			});

			async.parallel(tasks, next);
		}


		async.series([
			insertDefaultLanguage,
			insertArchiveData
		], callback);
	}


	/**
	 * Recreate all necessary global procedures
	 * @param callback
	 */
	function ensureProcedures(callback)
	{
		if (!config.server.database.ensureProcedures) return callback();

		console.debug("Ensuring database procedures");

		function resetAutoIncrement(next)
		{
			function drop(next)
			{
				db.query("DROP PROCEDURE IF EXISTS knx_admin_reset_auto_increments;", next);
			}

			function create()
			{
				var query = [
					"CREATE PROCEDURE knx_admin_reset_auto_increments()",
					"BEGIN"
				].join("\n");

				// now add copying code for all non-shadowed tables
				for (var tableName in DatabaseSchema.singular)
				{
					query += [
						"(SELECT @val := value FROM AutoIncrements WHERE table_name='"+tableName+"');",
						"IF (@val > 0) THEN",
						"	SET @qry = concat('ALTER TABLE "+tableName+" AUTO_INCREMENT=', @val+1);",
						"	PREPARE stmt FROM @qry;",
						"	EXECUTE stmt;",
						"END IF;",
						""
					].join("\n");
				}

				// and for shadowed ones, add different code
				for (var tableName in DatabaseSchema.shadowed)
				{
					query += [
						"(SELECT @val := MAX(id) FROM "+ShadowPrefix+tableName+");",
						"IF (@val > 0) THEN",
						"	SET @qry = concat('ALTER TABLE "+tableName+" AUTO_INCREMENT=', @val+1);",
						"	PREPARE stmt FROM @qry;",
						"	EXECUTE stmt;",
						"END IF;",
						""
					].join("\n");
				}

				// at the end, update Configuration table with the current date
				query += [
					"UPDATE Configuration SET lastAutoIncrementExec=NOW();"
				];

				query += [
					"END;"
				].join("\n");

				//console.debug(query.green);		// TODO
				db.query(query, next);
			}

			async.series([ drop, create	], next);
		}

		async.parallel([
			resetAutoIncrement
		], callback);
	}


	/**
	 * Ensure that the database schema matches the definition in the source code
	 * NOTE: this will not delete any existing columns or contraints, only add new
	 * @param callback
	 */
	function ensureSchema(callback)
	{
		console.debug("Ensuring database schema");
		db.query("CREATE DATABASE "+config.server.database.dbName, function(err, results)
		{
			if (err && err.code != "ER_DB_CREATE_EXISTS")
			{
				console.error(err.code);
				return callback && callback(err);
			}

			// Make sure we use the correct database in case it was just constructued
			db.query("USE "+config.server.database.dbName);

			if (!CreateSchema) return callback();


			// Add common columns and contraints to the schema
			var commonFields = [
				"changed_by		BIGINT UNSIGNED",
				"last_updated	DATETIME",
			];
			for (var tableName in DatabaseSchema.shadowed)
			{
				var table = DatabaseSchema.shadowed[tableName];

				for (var i=0; i<commonFields.length; i++)
				{
					// make sure we are adding each entry only once to a table schema
					var field = commonFields[i];
					if (table.indexOf(field) == -1)
						table.push(field);
				}
			}

			// Create all tables with their columns
			console.debug("Creating tables and contraints");


			/**
			 * Ensure all tables from the schema exist in the database, and then add all not yet added columns
			 * NOTE: this function does not exist columns already there, nor does it update existing ones
			 * @param next
			 */
			function ensureTables(next)
			{
				if (!CreateSchema) return next();
				console.log("Ensuring database tables".green);

				/**
				 * Create a table according to the definition
				 */
				function createTable(name, definition, shadow, next)
				{
					if (shadow) name = ShadowPrefix + name;		// shadow tables are prefixed

					// create table if not exists
					function createTable(next)
					{
						var query = "CREATE TABLE IF NOT EXISTS "+name+" (";
						if (shadow)
						{
							// For shadow tables we are storing the id of the original item
							// but also start and end dates of when a particular state (snapshot) takes effect.
							// ID is no longer unique or auto increment as now it's the combination of
							// the ID and valid_from that servers as unique key
							query +=	"id				BIGINT UNSIGNED			NOT NULL," +	// id of the item, same as in original table (though item in original table can be removed)
								"primary_id		BIGINT	UNSIGNED			NOT NULL	AUTO_INCREMENT, PRIMARY KEY (primary_id)," +
								"valid_from		DATETIME 		NOT NULL," +	// when this value was added/modified
								"valid_to		DATETIME," +					// when this value stopped being the current one (NULL means it is the current one)
								"deleted_by		INT";

							console.debug("Ensuring shadow table "+name);
						}
						else
						{
							// In case of ordinary table, each has an auto-incremented unique ID
							query +=	"id 			BIGINT UNSIGNED 		NOT NULL AUTO_INCREMENT," +
								"PRIMARY KEY (id)";

							console.debug("Ensuring table "+name);
						}
						query += ") ENGINE=InnoDB DEFAULT CHARSET=utf8 AUTO_INCREMENT=1;";
						db.query(query, next);
					}

					// create columns
					function createColumns(next)
					{
						// get all columns that are already in the table
						db.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = ? AND table_schema = ?", [name, config.server.database.dbName], function(err, columns)
						{
							if (err) return next(err);

							console.debug("Ensuring table "+name+" columns");

							// create only those, that don't exist yet (but are in the schema)
							var query = "";
							var regex = "";
							for (var i=0; i<(columns || []).length; i++)
								regex += (i?"|":"") + columns[i]["COLUMN_NAME"] + "\\s";
							regex = new RegExp("^("+regex+")");

							// add remaining columns from the schema that do not appear in database
							for (var i=0; i<definition.length; i++)
							{
								if (/^FOREIGN|UNIQUE|INDEX/.test(definition[i])) continue;		// don't create keys just now
								if (regex.test(definition[i])) continue;					// column already exists NOTE: ass all columns
								query += (query ? ", ":"") + definition[i];
								console.log("Adding column: %s".green, definition[i]);
							}

							if (shadow)  			//Remove this after all places have implemented primary_id
							{
								if (!regex.test("primary_id		BIGINT	UNSIGNED			NOT NULL	AUTO_INCREMENT, PRIMARY KEY (primary_id)"))
								{
									query += (query ? ", ":"") + "primary_id		BIGINT	UNSIGNED			NOT NULL	AUTO_INCREMENT, PRIMARY KEY (primary_id)";
									console.log("Adding column: %s".green, "primary_id		BIGINT	UNSIGNED			NOT NULL	AUTO_INCREMENT, PRIMARY KEY (primary_id)");
								}
							}

							// if nothing to add, continue
							if (!query) return next(null);

							// finalize the statement and execute
							query = "ALTER TABLE "+name+" ADD ("+query+")";

							// if we add a column, recreate triggers for they rely on the table schema
							BuildTriggers = true;

							db.query(query,	function(err)
							{
								if (err && err.code == "ER_DUP_FIELDNAME") err = null;		// supress duplicate error
								next(err);
							});
						});
					}

					function createViews(next)
					{
						if(!DatabaseSchema.encryptedView || !DatabaseSchema.encryptedView[name])
						{
							return next(null);
						}

						var encryptedTable = DatabaseSchema.encryptedView[name];
						console.log(encryptedTable);

						// get all columns that are already in the table
						db.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = ? AND table_schema = ?", [name, config.server.database.dbName], function(err, columns)
						{
							if (err) return next(err);

							console.debug("Creating encrypted table "+name+" views");

							var query = "";
							var viewColumns = [];

							for(var i=0; i <(columns || []).length; i++)
							{
								console.log(columns[i])
								if(encryptedTable[columns[i]["COLUMN_NAME"]])
								{
									viewColumns.push("CONVERT(AES_DECRYPT("+columns[i]["COLUMN_NAME"]+",'"+config.server.database.encryptionKey+"') USING utf8) AS " + columns[i]["COLUMN_NAME"])
								}
								else
								{
									viewColumns.push(columns[i]["COLUMN_NAME"]);
								}
							}

							var query = "CREATE OR REPLACE VIEW "+name+"_VIEW AS SELECT " + viewColumns.join(',') + " FROM " + name + ";";

							console.log(query);

							db.query(query, next);
						});

					}

					async.series([
						createTable,
						createColumns,
						createViews
					], next)
				}



				function createSingularTables(next)
				{
					async.each(Object.keys(DatabaseSchema.singular), function(tableName, next)
					{
						var definition = DatabaseSchema.singular[tableName];
						createTable(tableName, definition, false, next);
					}, next);
				}

				function createShadowedTables(next)
				{
					async.each(Object.keys(DatabaseSchema.shadowed), function(tableName, next)
					{
						var definition = DatabaseSchema.shadowed[tableName];
						createTable(tableName, definition, false, next);
					}, next);
				}

				function createShadowTables(next)
				{
					async.each(Object.keys(DatabaseSchema.shadowed), function(tableName, next)
					{
						var definition = DatabaseSchema.shadowed[tableName];
						createTable(tableName, definition, true, next);
					}, next);
				}

				async.parallel([
					createSingularTables,
					createShadowedTables,
					createShadowTables
				], next);
			}


			function ensureConstraints(next)
			{
				if (!BuildContraints) return next();
				console.log("Ensuring database constraints".green);


				// now create the foreign keys for singular tables only
				// shadow tables don't have contraints imposed as they refer to not only the ID but also specific
				// point in time
				function ensureKeys(name, definition, shadow, next)
				{
					console.debug("Creating foreign keys for table "+name);

					// retrieve list of existing constraints from the database
					db.query("SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE TABLE_NAME = ? AND TABLE_SCHEMA = ?", [name, config.server.database.dbName], function(err, results)
					{
						if (err) return next(err);

						// map out all created constraints
						var constraintsMap = {};
						results.forEach(function(result)
						{
							constraintsMap[result["CONSTRAINT_NAME"]] = true;
						});


						// retrieve also list of indexes
						db.query("SHOW INDEX FROM "+name, function(err, results)
						{
							if (err) return next(err);

							var indexesMap = {};
							results.forEach(function(result)
							{
								indexesMap[result["Key_name"]] = true;
							});


							var query = "";
							for (var i=0; i<definition.length; i++)
							{
								// if the definition contains FOREIGN keyword, add contstraint
								if (definition[i].indexOf("FOREIGN") == 0)
								{
									var field = definition[i].match(/FOREIGN KEY\s+\((\w+)\)/)[1];
									var constraintName = "fk_"+name+"_"+field;

									if (constraintsMap[constraintName]) continue;		// constraint already created

									console.log("Adding constraint %s".green, constraintName);

									query += (query.length ? ", ":"") + "CONSTRAINT "+constraintName+" "+definition[i];
								}

								// similiar with UNIQUE
								else if (definition[i].indexOf("UNIQUE") == 0)
								{
									var match = definition[i].match(/UNIQUE\s+(\w+)\s+(\(.+\))/);
									if (!match || match.length != 3) continue;
									var uqName = match[1];
									var uqCols = match[2];

									if (constraintsMap[uqName]) continue;				// constraint already created

									console.log("Adding constraint %s".green, uqName);

									query += (query.length ? ", ":"") + "CONSTRAINT "+uqName+" UNIQUE "+uqCols;
								}

								// and ADD INDEX
								else if (definition[i].indexOf("INDEX") == 0)
								{
									var match = definition[i].match(/INDEX\s+(\w+)\s+(\(.+\))/);
									if (!match || match.length != 3) continue;
									var uqName = match[1];
									var uqCols = match[2];

									if (indexesMap[uqName]) continue;				// constraint already created

									console.log("Adding index %s".green, uqName);

									query += (query.length ? ", ":"") +"INDEX "+uqName+" "+uqCols;
								}
							}


							if (query.length == 0) return next();
							console.debug("Creating keys for table "+name)
							query += " )";
							query = "ALTER TABLE "+name+" ADD (" + query;
							console.debug(query.green);
							db.query(query,	next);
						});
					});
				}

				//now create the index keys for shadow tables only
				function ensureArchiveKeys(name, definition, shadow, next)
				{
					console.debug("Creating index for table "+name);

						// retrieve also list of indexes
						db.query("SHOW INDEX FROM Archive_"+name, function(err, results)
						{
							if (err) return next(err);

							var indexesMap = {};
							results.forEach(function(result)
							{
								indexesMap[result["Key_name"]] = true;
							});


							var query = "";

							if(!indexesMap["ARCHIVE_PRIMARY"])
							{
								query += (query.length ? ", ":"") + "INDEX ARCHIVE_PRIMARY (id)";
							}


							for (var i=0; i<definition.length; i++)
							{
								// if the definition contains FOREIGN keyword, add contstraint
								if (definition[i].indexOf("FOREIGN") == 0)
								{
									var field = definition[i].match(/FOREIGN KEY\s+\((\w+)\)/)[1];
									var constraintName = "ARCHIVE_fk_"+name+"_"+field;

									if (indexesMap[constraintName]) continue;		// constraint already created

									console.log("Adding index %s".green, constraintName);

									query += (query.length ? ", ":"") + "INDEX "+constraintName+" ("+field+")";
								}

								// similiar with UNIQUE
								else if (definition[i].indexOf("UNIQUE") == 0)
								{
									var match = definition[i].match(/UNIQUE\s+(\w+)\s+(\(.+\))/);
									if (!match || match.length != 3) continue;
									var uqName = "ARCHIVE_" + match[1];
									var uqCols = match[2];

									if (indexesMap[uqName]) continue;				// constraint already created

									console.log("Adding index %s".green, uqName);

									query += (query.length ? ", ":"") + "INDEX "+uqName+" "+uqCols;
								}

								// and ADD INDEX
								else if (definition[i].indexOf("INDEX") == 0)
								{
									var match = definition[i].match(/INDEX\s+(\w+)\s+(\(.+\))/);
									if (!match || match.length != 3) continue;
									var uqName = "ARCHIVE_" + match[1];
									var uqCols = match[2];

									if (indexesMap[uqName]) continue;				// constraint already created

									console.log("Adding index %s".green, uqName);

									query += (query.length ? ", ":"") +"INDEX "+uqName+" "+uqCols;
								}
							}


							if (query.length == 0) return next();
							console.debug("Creating keys for table Archive_"+name)
							query += " )";
							query = "ALTER TABLE Archive_"+name+" ADD (" + query;
							console.debug(query.green);
							db.query(query,	next);
						});
				}


				function ensureSingularConstraints(next)
				{
					async.each(Object.keys(DatabaseSchema.singular), function(name, next)
					{
						var definition = DatabaseSchema.singular[name];
						ensureKeys(name, definition, false, next);
					}, next);
				}

				function ensureShadowedConstraints(next)
				{
					async.each(Object.keys(DatabaseSchema.shadowed), function(name, next)
					{
						var definition = DatabaseSchema.shadowed[name];
						ensureKeys(name, definition, true, next);
					}, next);
				}

				function ensureShadowConstraints(next)
				{
					async.each(Object.keys(DatabaseSchema.shadowed), function(name, next)
					{
						var definition = DatabaseSchema.shadowed[name];
						ensureArchiveKeys(name, definition, true, next);
					}, next);
				}

				async.parallel([
					ensureSingularConstraints,
					ensureShadowedConstraints,
					ensureShadowConstraints,
				], next);
			}

			/**
			 * Create Before Delete trigger for all foreign key.
			 * This is to allow cascade like delete while allowing audit tables to be updated.
			 */
			function createForeignKeyTriggers(next)
			{
				console.debug("Creating foreign key cascade-delete-like triggers");

				var foreignKeys = [];

				function checkIfTriggerExists(name, next)
				{
					var query = "SELECT COUNT(TRIGGER_NAME) AS count FROM INFORMATION_SCHEMA.TRIGGERS WHERE TRIGGER_SCHEMA = '"+config.server.database.dbName+"' AND TRIGGER_NAME = '"+name+"'";
					db.query(query, function(err, results)
					{
						if (err) return next(err);
						next(null, results[0].count != '0')
					});
				}

				function getForeignKeys(next)
				{
					var fkQuery = "SELECT " +
						"ke.REFERENCED_TABLE_NAME parent," +
						"ke.TABLE_NAME child," +
						"ke.COLUMN_NAME column_name," +
						"ke.REFERENCED_COLUMN_NAME referenced_column_name," +
						"ke.CONSTRAINT_NAME constraint_name FROM " +
						"information_schema.KEY_COLUMN_USAGE ke " +
						"WHERE ke.REFERENCED_TABLE_NAME IS NOT NULL " +
						"AND ke.TABLE_SCHEMA = '" + config.server.database.dbName + "' " +
						"ORDER BY ke.referenced_table_name;";

					db.query(fkQuery, function(err, results)
					{
						if (err) return next(err);
						if (results.length == 0) return next();
						foreignKeys = results;
						return next();
					});
				}

				function dropBeforeDeleteTrigger(next)
				{
					async.forEach(foreignKeys, function(constraint, next)
					{
						var query = "DROP TRIGGER IF EXISTS "+config.server.database.dbName+"."+constraint.parent  + "_BeforeDelete";
						db.query(query, next);
					},next)

				}

				function createBeforeDeleteTrigger(next)
				{
					var parentList = foreignKeys.reduce(function(p, c)
					{
						if (p.indexOf(c["parent"]) < 0)
						{
							p.push(c["parent"])
						}
						return p;
					}, []);
					var parentQueryList = {};

					function predefineTriggers(next)
					{
						async.forEach(parentList, function(parent,next)
						{
							checkIfTriggerExists(parent+"_BeforeDelete", function(err, yes)
							{
								if (err) return next(err);
								if (!yes)
								{
									parentQueryList[parent] = [
										"CREATE TRIGGER "+parent+"_BeforeDelete BEFORE DELETE ON " +parent,
										"FOR EACH ROW BEGIN"]
								}
								next();
							});

						}, next);
					}

					function populateTriggers(next)
					{
						async.forEach(foreignKeys, function(constraint, next)
						{
							if(parentQueryList[constraint.parent])
							{
								parentQueryList[constraint.parent] = parentQueryList[constraint.parent].concat(["DELETE FROM " + constraint.child + " WHERE ",
									constraint.child + "." + constraint.column_name + "=OLD." + constraint.referenced_column_name + ";"]);

							}
							next();
						},function(err)
						{
							if(err) return next(err);

							async.forEach(Object.keys(parentQueryList), function(parent, next)
							{
								parentQueryList[parent].push("END");
								parentQueryList[parent] = parentQueryList[parent].join("\n");
								db.query(parentQueryList[parent],next);
							},next);
						})
					}

					async.series([
						predefineTriggers,
						populateTriggers,
					], next);





				}

				if (BuildTriggers)
				{
					async.series([
						getForeignKeys,
						dropBeforeDeleteTrigger,
						createBeforeDeleteTrigger
					], function(err)
					{
						if (err) console.error(err);
						next();
					});
				}
				else
				{
					async.series([
						getForeignKeys,
						createBeforeDeleteTrigger,
					], function(err)
					{
						if (err) console.error(err);
						next();
					});
				}

			}


			// Create triggers for each shadowed table to automatically record the state changes in the audit table
			function createAuditTriggers(next)
			{
				function createTrigger(tableName, definition, next)
				{
					console.debug("Ensuring trigger for table "+tableName);
					var triggerName = "Audit_"+tableName;

					// Drop all insert, update and delete triggers
					function dropTriggers(next)
					{
						console.log("Dropping triggers "+triggerName);

						function dropInsertTrigger(next)
						{
							var query = "DROP TRIGGER IF EXISTS "+config.server.database.dbName+"."+triggerName+"_Insert";
							db.query(query, next);
						}

						function dropBeforeInsertTrigger(next)
						{
							var query = "DROP TRIGGER IF EXISTS "+config.server.database.dbName+"."+triggerName+"_BeforeInsert";
							db.query(query, next);
						}

						function dropAfterInsertTrigger(next)
						{
							var query = "DROP TRIGGER IF EXISTS "+config.server.database.dbName+"."+triggerName+"_AfterInsert";
							db.query(query, next);
						}

						function dropUpdateTrigger(next)
						{
							var query = "DROP TRIGGER IF EXISTS "+config.server.database.dbName+"."+triggerName+"_Update";
							db.query(query, next);
						}

						function dropDeleteTrigger(next)
						{
							var query = "DROP TRIGGER IF EXISTS "+config.server.database.dbName+"."+triggerName+"_Delete";
							db.query(query, next);
						}

						async.parallel([
							dropInsertTrigger,
							dropBeforeInsertTrigger,
							dropAfterInsertTrigger,
							dropUpdateTrigger,
							dropDeleteTrigger
						], next);
					}

					// Add some extra trigger code when updating
					function addUpdateTriggerCode(tableName)
					{
						if (tableName == "Publishers")
						{
							return [
								"IF (OLD.title <> NEW.title) THEN",
								"UPDATE Dashboard SET publisher_title=NEW.title, last_updated=NOW() WHERE publisher_id=NEW.id;",
								"END IF;"
							].join("\n");
						}
						return "";
					}


					// Create insert, update and delete triggers
					function insertTriggers(next)
					{
						var changedCondition = [];
						var columns = getTableColumns(definition);

						//console.log(definition, columns)

						for (var i=0; i<columns.length; i++)
						{
							var name = columns[i];
							if (name == "last_updated" || name == "changed_by") continue;		// ignore irrelevant columns
							changedCondition.push("!(NEW."+name+" <=> OLD."+name+")");
						}

						changedCondition = changedCondition.length ?
							changedCondition.join(" OR ") :
							"FALSE";

						columns.push("id");
						var values = columns.map(function(c) { return "NEW."+c;	}).join(",");
						columns.push("valid_from");
						columns.push("valid_to");
						var columnNames = columns.join(",");

						console.debug("Creating triggers for table "+tableName);

						function checkIfTriggerExists(name, next)
						{
							var query = "SELECT COUNT(TRIGGER_NAME) AS count FROM INFORMATION_SCHEMA.TRIGGERS WHERE TRIGGER_SCHEMA = '"+config.server.database.dbName+"' AND TRIGGER_NAME = '"+name+"'";
							db.query(query, function(err, results)
							{
								if (err) return next(err);
								next(null, results[0].count != '0')
							});
						}

						// Update trigger checks if any of fields for that particular table has changed it's value
						// and if yes, it adds new audit record in archive table with new values and closes the old one
						function createUpdateTrigger(next)
						{
							checkIfTriggerExists(triggerName+"_Update", function(err, yes)
							{
								if (err) return next(err);
								if (yes) return next(null);

								// If @audit_query has been set to 1, this trigger will create an audit row for the new data
								// with changed_by column set to @audit_changedBy, and subsequently will reset those variables
								var query = [
									"CREATE TRIGGER "+triggerName+"_Update BEFORE UPDATE ON "+tableName,
									"FOR EACH ROW BEGIN",
									//"IF (NEW.last_updated IS NULL OR NEW.last_updated <> OLD.last_updated) THEN",
									"IF ("+changedCondition+") THEN",
									"SET NEW.last_updated = NOW();",
									"SET NEW.changed_by = @audit_changedBy;",
									"SET @audit_query = 0;",
									"SET @audit_changedBy = NULL;",
									"UPDATE "+ShadowPrefix+tableName+" SET valid_to=NOW() WHERE valid_to IS NULL AND id=OLD.id;",
									"REPLACE INTO "+ShadowPrefix+tableName+" ("+columns+") VALUES ("+values+", NOW(), NULL);",
									"END IF;",
									addUpdateTriggerCode(tableName),
									encryptUpdate(),
									"END"
								].join("\n");

								console.log(query.green);
								db.query(query, next);
							});

							function encryptUpdate()
							{
								if(!DatabaseSchema.encryptedView || !DatabaseSchema.encryptedView[tableName])
								{
									return "";
								}

								var encryptedTable = DatabaseSchema.encryptedView[tableName];

								var encryptedTrigger = [];

								for(var i in encryptedTable)
								{
									var encryptedTriggerString = "SET NEW.:column = IF(NEW.:column = OLD.:column, NEW.:column, AES_ENCRYPT(NEW.:column,':aeskey'));";
									encryptedTriggerString = encryptedTriggerString.replace(/:column/g,i);
									encryptedTriggerString = encryptedTriggerString.replace(/:aeskey/g,config.server.database.encryptionKey);
									encryptedTrigger.push(encryptedTriggerString);

								}
								return encryptedTrigger.join("\n");
							}
						}

						// Before Insert triggers sets changed_by field for the new row
						function createBeforeInsertTrigger(next)
						{
							checkIfTriggerExists(triggerName+"_BeforeInsert", function(err, yes)
							{
								if (err) return next(err);
								if (yes) return next(null);

								// Insert will always trigger creating new row in audit table, regardless with query was
								// audited or not
								var query = [
									"CREATE TRIGGER "+triggerName+"_BeforeInsert BEFORE INSERT ON "+tableName,
									"FOR EACH ROW BEGIN",
									"SET NEW.last_updated = NOW();",
									"SET NEW.changed_by = @audit_changedBy;",
									"SET @audit_query = 0;",
									"SET @audit_changedBy = NULL;",
									encryptInsert(),
									"END"
								].join("\n");

								console.log(query.green);
								db.query(query, next);
							});

							function encryptInsert()
							{
								if(!DatabaseSchema.encryptedView || !DatabaseSchema.encryptedView[tableName])
								{
									return "";
								}

								var encryptedTable = DatabaseSchema.encryptedView[tableName];

								var encryptedTrigger = [];

								for(var i in encryptedTable)
								{
									var encryptedTriggerString = "SET NEW.:column = AES_ENCRYPT(NEW.:column,':aeskey');";
									encryptedTriggerString = encryptedTriggerString.replace(/:column/g,i);
									encryptedTriggerString = encryptedTriggerString.replace(/:aeskey/g,config.server.database.encryptionKey);
									encryptedTrigger.push(encryptedTriggerString);

								}
								return encryptedTrigger.join("\n");
							}
						}

						// After Insert trigger copies the row into audit trail table
						function createAfterInsertTrigger(next)
						{
							checkIfTriggerExists(triggerName+"_AfterInsert", function(err, yes)
							{
								if (err) return next(err);
								if (yes) return next(null);

								// Insert will always trigger creating new row in audit table, regardless with query was
								// audited or not
								var query = [
									"CREATE TRIGGER "+triggerName+"_AfterInsert AFTER INSERT ON "+tableName,
									"FOR EACH ROW BEGIN",
									"UPDATE "+ShadowPrefix+tableName+" SET valid_to=NOW() WHERE valid_to IS NULL AND id=NEW.id;",
									"REPLACE INTO "+ShadowPrefix+tableName+" ("+columns+") VALUES ("+values+", NOW(), NULL);",
									"END"
								].join("\n");

								console.log(query.green);
								db.query(query, next);
							});
						}

						// Delete trigger alwats creates an audit trail record, but if @audit_changedBy was set
						// (via auditedQuery) it will be put under "deleted_by" field
						function createDeleteTrigger(next)
						{
							checkIfTriggerExists(triggerName+"_Delete", function(err, yes)
							{
								if (err) return next(err);
								if (yes) return next(null);

								// Delete trigger will also alter the audit table, regardless of whether audit has been set or not
								var query = [
									"CREATE TRIGGER "+triggerName+"_Delete AFTER DELETE ON "+tableName,
									"FOR EACH ROW BEGIN",
									"UPDATE "+ShadowPrefix+tableName+" SET valid_to=NOW(), deleted_by=@audit_changedBy, last_updated=NOW() WHERE valid_to IS NULL AND id=OLD.id;",
									"SET @audit_query = 0;",
									"SET @audit_changedBy = NULL;",
									"END"
								].join("\n");

								console.log(query.green);
								db.query(query, next);
							});
						}

						async.parallel([
							createUpdateTrigger,
							createBeforeInsertTrigger,
							createAfterInsertTrigger,
							createDeleteTrigger
						], next);
					}


					// If BuildTriggers is set to true, first drop all driggers and then create new ones from scratch
					// Otherwise create triggers only if they don't exist yet
					if (BuildTriggers)
					{
						async.series([
							dropTriggers,
							insertTriggers
						], next);
					}
					else
					{
						insertTriggers(next);
					}
				}


				async.each(Object.keys(DatabaseSchema.shadowed), function(tableName, next)
				{
					var definition = DatabaseSchema.shadowed[tableName];
					createTrigger(tableName, definition, next);
				}, next);
			}


			/**
			 * Create After Insert trigger for non-shadowed tables that will update the corresponding values
			 * in AutoIncrements table. These triggers apply only to non-shadowed tables. Should there be a need
			 * for other types of tables too, the trigger must be integrated with the auditing AfterInsert trigger
			 */
			function createAutoIncrementTriggers(next)
			{
				console.debug("Creating auto-increment triggers");

				function populateAutoIncrements(next)
				{
					db.query("SELECT table_name FROM AutoIncrements", function(err, results)
					{
						if (err) return next(err);

						var names = {};			// map of table names already created
						results.map(function(r) { names[r.table_name] = true; });

						// try to create the rest
						var toCreate = [];
						for (var tableName in DatabaseSchema.singular)
							if (!names[tableName]) toCreate.push(tableName);

						// if no tables are there left to be created, end
						if (!toCreate.length) return next();

						// prepare an insert query
						var query = "INSERT INTO AutoIncrements (table_name) VALUES ";
						var values = [];
						for (var i=0; i<toCreate.length; i++)
							values.push("('"+toCreate[i]+"')");
						query += values.join(",");

						console.debug(query.green);	// TODO

						db.query(query, next);
					});
				}

				function updateAutoIncrementValues(next)
				{
					var tables = [];

					for (var tableName in DatabaseSchema.singular)
						tables.push(tableName);

					async.each(tables, function(tableName, next)
					{
						db.query("SELECT MAX(id) AS maxId FROM "+tableName, function(err, results)
						{
							if (err) return next(err);

							var id = results[0].maxId+1;

							db.query("UPDATE AutoIncrements SET value=? WHERE table_name=?", [id, tableName], next);
						});
					}, next);
				}

				function dropTriggers(next)
				{
					async.forEach(Object.keys(DatabaseSchema.singular), function(tableName, next)
					{
						var query = "DROP TRIGGER IF EXISTS "+config.server.database.dbName+".AutoIncrement_"+tableName+"_AfterInsert";
						console.debug(query.magenta)//TODO
						db.query(query, next);
					}, next);
				}

				function createTriggers(next)
				{
					async.forEach(Object.keys(DatabaseSchema.singular), function(tableName, next)
					{
						var query = [
							"CREATE TRIGGER AutoIncrement_"+tableName+"_AfterInsert AFTER INSERT ON "+tableName,
							"FOR EACH ROW BEGIN",
							"UPDATE AutoIncrements SET value=NEW.id WHERE table_name='"+tableName+"' AND value<NEW.id;",
							"END"
						].join("\n");
						console.debug(query.green);	// TODO
						db.query(query, next);
					}, next);
				}

				async.series([
					dropTriggers,
					populateAutoIncrements,
					updateAutoIncrementValues,
					createTriggers
				], function(err)
				{
					if (err) console.error(err);
					next();
				});
			}


			/**
			 * Create tables used for translation data
			 * @param next
			 */
			function createTranslationTables(next)
			{
				console.log("Ensuring translation tables".green);

				// Ensure all translation tables are created
				function ensureTables(next)
				{
					async.each(Object.keys(DatabaseSchema.translations), function(tableName, next)
					{
						console.debug("Ensuring translation table %s_Translations".green, tableName);
						var columns = DatabaseSchema.translations[tableName];
						var query =
							"CREATE TABLE IF NOT EXISTS "+tableName+"_Translations ("+
								"	id 			INTEGER 		NOT NULL AUTO_INCREMENT," +
								"	PRIMARY KEY (id)"+
								") ENGINE=InnoDB DEFAULT CHARSET=utf8 AUTO_INCREMENT=1;";

						db.query(query,	function(err)
						{
							if (err && (
								err.code == "ER_CANT_CREATE_TABLE" ||
									err.code == "ER_DUP_KEY" ||
									err.code == "ER_DUP_KEYNAME")) err = null;		// supress duplicate error
							next(err);
						});
					}, next);
				}

				// Ensure all columns in translation tables exist
				// get all columns that are already in the table
				function ensureColumns(next)
				{
					async.eachLimit(Object.keys(DatabaseSchema.translations), 5, function(tableName, next)
					{
						db.query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = ? AND table_schema = ?", [tableName+"_Translations", config.server.database.dbName], function(err, columns)
						{
							if (err) return next(err);

							var definition = DatabaseSchema.translations[tableName];

							// create only those, that don't exist yet (but are in the schema)
							var query = "";
							var regex = "";
							for (var i=0; i<(columns || []).length; i++)
								regex += (i?"|":"") + columns[i]["COLUMN_NAME"];
							regex = new RegExp("^("+regex+")");

							// add remaining columns from the schema that do not appear in database
							for (var i=0; i<definition.length; i++)
							{
								if (regex.test(definition[i])) continue;					// column already exists
								if (definition[i].indexOf("FOREIGN") == 0 ||
									definition[i].indexOf("UNIQUE") == 0) continue;			// not a column
								query += (query ? ", ":"") + definition[i];
							}

							// if nothing to add, continue
							if (!query) return next(null);

							// finalize the statement and execute
							query = "ALTER TABLE "+tableName+"_Translations ADD ("+query+")";
							console.log(query.green);

							db.query(query,	function(err)
							{
								if (err && (
									err.code == "ER_DUP_KEY" ||
										err.code == "ER_DUP_KEYNAME")) err = null;		// supress duplicate error
								next(err);
							});
						});
					}, next);
				}

				// Ensure all foreign key and unique constraints are added
				function ensureConstraints(next)
				{
					async.eachLimit(Object.keys(DatabaseSchema.translations), 5, function(tableName, next)
					{
						var definition = DatabaseSchema.translations[tableName];

						console.debug("Creating foreign keys for table "+tableName);

						var query = "";
						for (var i=0; i<definition.length; i++)
						{
							// if the definition contains FOREIGN keyword, add contstraint
							if (definition[i].indexOf("FOREIGN") == 0)
							{
								var field = definition[i].match(/FOREIGN KEY\s+\((\w+)\)/)[1];
								query += (query.length ? ", ":"") + "CONSTRAINT fk_"+tableName+"_"+field+" "+definition[i];
							}

							// similiar with UNIQUE
							else if (definition[i].indexOf("UNIQUE") == 0)
							{
								var match = definition[i].match(/UNIQUE\s+(\w+)\s+(\(.+\))/);
								if (!match || match.length != 3) continue;
								var uqName = match[1];
								var uqCols = match[2];
								query += (query.length ? ", ":"") + "CONSTRAINT "+uqName+" UNIQUE "+uqCols;
							}
						}

						if (query.length == 0) return next();

						query += " )";
						query = "ALTER TABLE "+tableName+"_Translations ADD (" + query;
						console.debug(query.green);
						db.query(query,	function(err)
						{
							if (err && (
								err.code == "ER_CANT_CREATE_TABLE" ||
									err.code == "ER_DUP_KEY" ||
									err.code == "ER_DUP_KEYNAME")) err = null;		// supress duplicate error
							next(err);
						});
					}, next);
				}

				async.series([
					ensureTables,
					ensureColumns,
					ensureConstraints
				], next);
			}

			async.series([
				ensureTables,
				ensureConstraints,
				createForeignKeyTriggers,
				createAuditTriggers,
				createTranslationTables,
				createAutoIncrementTriggers
			], callback);
		});
	}


	function escape(value)
	{
		return mysql.escape(value);
	}



	/**
	 * Map joined arrays into the main object map
	 * @param into		- main object that will be top level in the result map
	 * @param what		- array of key/pair arrays defining which joined array will be embeeded under what arrya name in the main object
	 * @param results	- list of SQL results
	 * @return {Object}
	 */
	function embed(into, what, results)
	{
		var items = {};
		var counter = 0;
		for (var i=0; i<results.length; i++)
		{
			var r = results[i];
			if (!r || !r[into]) continue;
			var item = items[r[into].id];
			if (!item)
			{
				item = items[r[into].id] = r[into];
				item._index = counter++;				// counter is used to retain original ordering from the database
			}

			for (var j=0; j<what.length; j++)
			{
				var arrayName = what[j][0];			// e.g. "dicount" (under item.discount)
				var whatName = what[j][1];			// e.g. "item_disc"
				item[arrayName] = item[arrayName] || {};
				if (!item[arrayName] || !r[whatName]) continue;
				item[arrayName][r[whatName].id] = r[whatName];
			}

			// add orphaned columns into the main object
			if (r[""])
			{
				for (var field in r[""])
					item[field] = r[""][field];
			}
		}

		// now convert everything to arrays
		var itemsArray = [];
		for (var key in items)
		{
			var item = items[key];
			itemsArray[item._index] = item;

			for (var j=0; j<what.length; j++)
			{
				var arrayName = what[j][0];
				var whatName = what[j][1];
				var arrMap = item[arrayName];
				var arr = [];
				for (var k in arrMap)
				{
					if (arrMap[k].id == null) continue;
					arr.push(arrMap[k]);
				}

				if (what[j][2] == true)
					item[arrayName] = arr[0];
				else
					item[arrayName] = arr;
			}

			delete item._index;
		}

		return itemsArray;
	}


	/**
	 * Embed single objects within nested items
	 * @param parents			- list of parent objects
	 * @param child				- name of the children array to embed items to
	 * @param embedded			- name of the embedded field in the results array
	 * @param embedAs			- name of the field to put the found property in
	 * @param idField			- name of the child's property that points to the embeddable id
	 * @param results			- list of rows from the database
	 */
	function innerEmbed(parents, child, embedded, embedAs, idField, results)
	{
		// map out all embedded items first
		var map = {};
		results.forEach(function(row)
		{
			var item = row[embedded];
			if (item)
				map[item.id] = item;
		});

		// now put linked items into the child objects
		parents.forEach(function(parent)
		{
			if (!Array.isArray(parent[child]))
			{
				if (parent[child][idField])
					parent[child][embedAs] = map[parent[child][idField]];
			}
			else
			{
				parent[child].forEach(function(child)
				{
					if (child[idField])
						child[embedAs] = map[child[idField]];
				});
			}
		});
	}


	/**
	 * Add LIMIT directive to the SQL query using pagination parameters
	 * @param pagination
	 * @return {String}
	 */
	function limit(pagination)
	{
		if (!pagination) return "";
		return " LIMIT "+parseInt(pagination.offset || 0)+","+parseInt(pagination.limit || 999);
	}


	/**
	 * Get list of column names defined in database schema (excluding those added programmatically)
	 * @param definition
	 * @return {Array}
	 */
	function getTableColumns(definition)
	{
		var ret = [];
		for (var i=0; i<definition.length; i++)
		{
			var name = definition[i].match(/^\w+/);
			if (/^FOREIGN|UNIQUE|INDEX/.test(name)) continue;
			ret.push(name[0]);
		}
		return ret;
	}


	/**
	 * Insert translation records for a given object and specified field names
	 * @param table				- which table does the object belong to (not the translation table itself)
	 * @param object			- object
	 * @param next
	 * @param [trans]
	 * @param [changedBy]
	 */
	function insertTranslations(table, object, next, trans, changedBy)
	{
		var fields = getTableColumns(DatabaseSchema.translations[table]).filter(function(column)
		{
			return column != "ref_id" && column != "code";
		});

		if (!object.id)
			return console.trace("Invalid object id when inserting translations");

		var query = "REPLACE INTO "+table+"_Translations (ref_id, code, "+fields.join(",")+") VALUES ";
		var languages = Object.keys(object[fields[0]]);
		if (!languages.length) return next();

		var values = [];
		query += languages.map(function(code)
		{
			var placeholders = ["?", "?"];
			values = values.concat([object.id, code]);
			fields.map(function(f)
			{
				values.push(object[f] ? object[f][code] : "");
				placeholders.push("?");
			});
			return "("+placeholders.join(",")+")";
		}).join(",");

		auditedQuery(query, values, changedBy, next, trans);
	}


	/**
	 * Execute a series of queries in a single transaction
	 * @param queries
	 * @param callback
	 * @param [transaction]		- execute the queries as part of already created transaction, instead of creating a new one
	 */
	function runQueriesAsTransaction(queries, callback, transaction)
	{
		if(transaction)
		{
			async.eachSeries(queries, function(query, next)
			{
				try
				{
					(query)(next, transaction);
				}
				catch (err)
				{
					next(err);
				}
			}, callback);

		}
		else
		{
			var trans = db.startTransaction();

			function handle(err)
			{
				if (!err || trans.rolledback) return;
				if (trans.rollback) trans.rollback(function() { callback && callback(err); });
			}

			// Execute all queries one by one providing a transaction object
			async.eachSeries(queries, function(query, next)
			{
				try
				{
					(query)(next, trans);
				}
				catch (err)
				{
					next(err);
				}
			}, function(err)
			{
				if (err) return handle(err);
				trans.commit(callback);
			});

			trans.execute();
		}
	}


	/**
	 * Query that will leave an audit trail by setting the flags @audit_query and @audit_changeBy.
	 * These flags will persist only on per-connection basis and will be reset after every UPDATE trigger
	 * @param query
	 * @param values
	 * @param changedBy
	 * @param [callback]
	 * @param [trans]
	 */
	function auditedQuery(query, values, changedBy, callback, trans)
	{
		// if no particular user provided, make change done by System
		if (!changedBy) changedBy = SystemUser;

		(trans || db).query("SET @audit_query = 1, @audit_changedBy = "+db.escape(changedBy)+";", function(err)
		{
			if (err) return callback && callback(err);
			(trans || db).query(query, values, callback);
		});
	}


	/**
	 * Query that uses transaction connection
	 * @param query
	 * @param values
	 * @param callback
	 */
	function transactedQuery(query, values, callback)
	{
		db.query.apply(this, arguments);
	}


	function auditedTransactedQuery(query, values, callback)
	{
		auditedQuery.apply(this, arguments);
	}


	/**
	 * Execute a query on a connection from the pool. Connection will be closed immediately after
	 * NOTE: pool connections don't guarantee transaction integrity!
	 * @param query
	 * @param [values]
	 * @param callback
	 */
	function poolQuery(query, values, callback)
	{
		if (arguments.length != 2 && arguments.length !=3 ) return callback("Incorrect arguments count for query: %d", arguments.length, query);

		callback = arguments[arguments.length-1];
		if (typeof callback != "function") callback = null;
		var args = arguments;

		getConnection(function(err, db)
		{
			if (err) return callback && callback(err);

			//console.log("CONNECTION %d OBTAINED".cyan, db.id);//TODO

			function cb(err, results)
			{
				//console.log("CONNECTION %d RELEASED".cyan, db.id);//TODO
				db.release();
				callback && callback(err, results);
			}

			try
			{
//				console.log("CONNECTION %d EXECUTING QUERY: ", db.id, args[0]);//TODO
				config.server.DEBUGQUERIES && console.debug("------------------------------------".red);
				config.server.DEBUGQUERIES && console.debug(args[0].green);

				if (args.length == 2)
					db.query(args[0], cb);
				else if (args.length == 3)
					db.query(args[0], args[1], cb);
				else
				{
					db.release();
					callback && callback("Invalid number of arguments");
				}
			}
			catch (e)
			{
//				console.log("CONNECTION %d RELEASED (exception: %s)".cyan, db.id, e);//TODO
				db.release();
			}
		});
	}


	/**
	 * Same as above but the query will be audited (changed_by set and audit table triggers fired)
	 */
	function auditedPoolQuery(query, values, changedBy, callback)
	{
		getConnection(function(err, db)
		{
			if (err) return callback(err);

			function cb(err, results)
			{
				db.release();
				callback(err, results);
			}

			try
			{
				auditedQuery(query, values, changedBy, cb, db);
			}
			catch(err)
			{
				cb(err);
			}
		});
	}


	/**
	 * Audited utility functions to operate on SQL tables
	 */
	function insertToTable(tableName, object, fields, callback, trans, changedBy)
	{
		if (!changedBy && trans && (typeof trans == "number"))
		{
			changedBy = trans;
			trans = null;
		}

		var values = [];

		var tempFields = [];
		for (var i=0; i<fields.length; i++)
		{
			if(fields[i].toLowerCase() != "id")
			{
				tempFields.push(mysql.escapeId(fields[i]));
				values.push(object[fields[i]]);
			}
		}

		fields = tempFields;

		var placeholders = Array(fields.length+1).join(",?").substr(1);
		var query = "INSERT INTO "+tableName+" ("+fields.join(",")+") VALUES ("+placeholders+")";

		config.server.DEBUGQUERIES && console.debug(query.yellow);

		auditedQuery(query, values, changedBy, function(err, ret)
		{
			object.id = ret && ret.insertId;
			callback && callback(err, ret && ret.insertId)
		}, trans);
	}

	/**
	 * Audited utility function to multiple insert nested array (array of array)
	 * @param tableName
	 * @param arrObj
	 * @param fields
	 * @param callback
	 * @param trans
	 * @param changeBy
	 */
	function insertArrayToTable(tableName, arrObj, fields, callback, trans, changedBy)
	{
		if (!changedBy && trans && (typeof trans == "number"))
		{
			changedBy = trans;
			trans = null;
		}

		//Sanitize fields
		var tempFields = [];
		for(var i in fields)
		{
			if(fields[i].toLowerCase() != 'id')
			{

			}
		}

		//bucked nested array
		var values = [];
		arrObj.forEach(function(object){
			var tempVal = [];
			for (var i=0; i<fields.length; i++)
			{
				if(fields[i].toLowerCase() != 'id')
				{
					tempVal.push(object[fields[i]]);
				}
			}
			values.push(tempVal);
		})

		for(var i in fields)
		{
			fields[i] = mysql.escapeId(fields[i]);
		}

		var query = "INSERT INTO "+tableName+" ("+fields.join(",")+") VALUES ?";

		config.server.DEBUGQUERIES && console.debug(query.yellow);

		auditedQuery(query, [values], changedBy, function(err, ret)
		{
			callback && callback(err)
		}, trans);
	}

	function updateTable(tableName, object, fields, where, whereValues, callback, trans, changedBy)
	{
		if (!changedBy && trans && (typeof trans == "number"))
		{
			changedBy = trans;
			trans = null;
		}

		// Nothing to update
		if (!fields.length) return callback();

		// Create query parts from the supplied fields/values
		var placeholders = Array(fields.length+1).join(",?").substr(1);		// create ?,?,? for field values
		var keys = [];
		var values = [];

		for (var i=0; i<fields.length; i++)
		{
			if(fields[i].toLowerCase() != "id")
			{
				keys.push(mysql.escapeId(fields[i])+"=?");
				values.push(object[fields[i]]);
			}
		}

		keys = keys.join(",");
		values = values.concat(whereValues);

		var query = "UPDATE "+tableName+" SET "+keys+" "+(where || "");
		config.server.DEBUGQUERIES && console.debug(query.yellow);
		auditedQuery(query, values, changedBy, callback, trans);
	}


	function removeFromTable(tableName, id, callback, trans, changedBy)
	{
		if (!changedBy && trans && (typeof trans == "number"))
		{
			changedBy = trans;
			trans = null;
		}

		var query = "DELETE FROM "+tableName+" WHERE id=?";
		config.server.DEBUGQUERIES && console.debug(query.yellow);
		auditedQuery(query, [id], changedBy, callback, trans);
	}


	function removeFromTableWhere(tableName, where, whereValues, callback, trans, changedBy)
	{
		if (!changedBy && trans && (typeof trans == "number"))
		{
			changedBy = trans;
			trans = null;
		}

		var query = "DELETE FROM "+tableName+" "+where;
		config.server.DEBUGQUERIES && console.debug(query.yellow);
		auditedQuery(query, whereValues, changedBy, callback, trans);
	}


	function removeFromTableWhereInnerJoin(tableName, join, where, whereValues, callback, trans, changedBy)
	{
		if (!changedBy && trans && (typeof trans == "number"))
		{
			changedBy = trans;
			trans = null;
		}

		var query = "DELETE a FROM "+tableName+" a "+join+" "+where;
		config.server.DEBUGQUERIES && console.debug(query.yellow);
		auditedQuery(query, whereValues, changedBy, callback, trans);
	}


	/**
	 * Insert batch of items into a table in one query, optionally update records on duplicates
	 * @param tableName
	 * @param elements
	 * @param callback
	 * @param onDupUpdate		- ON DUPLICATE KEY UPDATE ?
	 * @return {*}
	 */
	function insertBatch(tableName, elements, callback, onDupUpdate)
	{
		if (!elements.length) return callback();

		var columns = Object.keys(elements[0]);

		var query =	"INSERT INTO "+tableName+" ("+columns.join(",")+") VALUES ";
		var values = [];

		query += elements.map(function(element)
		{
			var placeholders = [];
			for (var i=0; i<columns.length; i++)
			{
				placeholders.push("?");
				values.push(element[columns[i]]);
			}
			return "("+placeholders.join(",")+")";
		}).join(",");

		if (onDupUpdate)
		{
			query += " ON DUPLICATE KEY UPDATE ";

			var v = [];
			for (var i=0; i<columns.length; i++)
				v.push(columns[i]+"=VALUES("+columns[i]+")");

			query += v.join(",");
		}

		config.server.DEBUGQUERIES && console.debug(query.yellow);

		Database.poolQuery(query, values, callback);
	}

	/**
	 * Utility function for generating code stub used for Audit Trail
	 * @param key
	 * @param [trans]
	 * @return {String}
	 */
	function getValidCode(key, trans)
	{
		trans = trans || "trans";
		return " "+key+".valid_from <= "+trans+".created_date AND ("+key+".valid_to > "+trans+".created_date OR "+key+".valid_to IS NULL) ";
	}


	//Sanitize sensitive account information
	function accountSanitize(account)
	{
		if(account)
		{
			delete account.password;

		}
		return account;

	}


	/**
	 * Retrieve system configuration from database
	 * @param callback
	 */
	function getConfiguration(callback)
	{
		db.query("SELECT * FROM Configuration", function(err, results)
		{
			if (err) return callback && callback(err);

			var conf = results[0];

			// copy the configuration to global object
			for (var key in conf)
				config.server.system[key] = conf[key];

			callback && callback(null, config.server.system);
		});
	}

	/**
	 * Update selected fields in the configuration object
	 * @param config
	 * @param callback
	 */
	function updateConfiguration(config, callback)
	{
		updateTable("Configuration", config, Object.keys(config), "", [], function(err)
		{
			if (err) return callback && callback(err);

			Database.getConfiguration(function(err)
			{
				if (err) console.error("Error reading configuration");
				callback && callback();
			});
		});
	}



	/**
	 * Get users with their necessary data embedded
	 * @param where
	 * @param values
	 * @param callback
	 * @param [options]
	 */
	function getUsersWhere(where, values, callback, options)
	{
		var joins = [
			{ table: "Accounts_VIEW",	alias: "user",	fields: ["*"]},
		];

		var query = new QueryBuilder("Accounts_VIEW", "user", joins, where, options);

		query.execute(values, function(err, res)
		{
			if (err) return callback(err);

			var results = res.results;

			query.embedTranslations(results);

			var users = embed("user", [
			], results);

			res.results = users;

			callback(null, users, res);
		});
	}

	/**
	 * Get clients with their necessary data embedded
	 * @param where
	 * @param values
	 * @param callback
	 * @param [options]
	 */
	function getClientsWhere(where, values, callback, options)
	{
		var joins = [
		];

		var query = new QueryBuilder("Clients", "client", joins, where, options);

		query.execute(values, function(err, res)
		{
			if (err) return callback(err);

			var clients = embed("client", [
			], res.results);

			res.results = clients;

			callback(null, clients, res);
		});
	}

	/**
	 * Insert new user
	 * @param user
	 * @param callback fn(err, insertId)
	 * @param [userId]
	 */
	function addUser(user, callback, userId)
	{
		function insertAccount(next, trans)
		{
			insertToTable("Accounts", user, Object.keys(user), next, trans, userId);
		}

		runQueriesAsTransaction([
			insertAccount
		],callback);
	}

	/**
	 * Update account information
	 * @param id
	 * @param user
	 * @param callback
	 * @param [userId]
	 */
	function updateUser(id, user, callback, userId)
	{
		updateTable("Accounts", user, Object.keys(user), "WHERE id=?", [id], callback, userId);
	}

	/**
	 * Create password reset entry for given user
	 * @param userId
	 * @param callback
	 */
	function createPasswordResetEntry(userId, callback)
	{
		poolQuery("SELECT COUNT(1) AS cnt FROM PasswordReset WHERE user_id=?", [userId], function(err, results)
		{
			if (err) return callback && callback(err);

			var count = results[0].cnt;
			var expireDate = new Date(Date.now() + config.server.system.passwordResetLifespan * 60 * 60 * 1000);
			var pathkey = Shared.generateString(32);

			function finish(err)
			{
				callback && callback(err, pathkey);
			}

			if (count == 0)
			{
				// insert new password reset entry to the database
				poolQuery("INSERT INTO PasswordReset(user_id, pathkey, expire_date) VALUES (?,?,?)", [
					userId, pathkey, expireDate
				], finish);
			}
			else
			{
				// update existing entry
				poolQuery("UPDATE PasswordReset SET pathkey=?, expire_date=? WHERE user_id=?", [
					pathkey, expireDate, userId
				], finish);
			}
		});
	}

	/**
	 * Get password reset entry for specified key
	 * @param key
	 * @param callback
	 */
	function getPasswordResetEntry(key, callback)
	{
		var currentDate = new Date();
		poolQuery("SELECT * FROM PasswordReset WHERE pathkey=? AND expire_date>?", [key, currentDate], function(err, results)
		{
			if (err) return callback(err);
			if (!results.length) return callback("No entry found for key "+key);

			callback(null, results[0]);
		});
	}

	/**
	 * Remove password reset entry for specified key
	 * @param userId
	 * @param callback
	 */
	function removePasswordResetEntry(userId, callback)
	{
		poolQuery("DELETE FROM PasswordReset WHERE user_id=?", [userId], callback);
	}

	/**
	 * Emails queue
	 */
	function getQueuedEmails(callback)
	{
		poolQuery("SELECT * FROM EmailQueue", callback);
	}

	function addEmailToQueue(message, type, callback)
	{
		poolQuery("INSERT INTO EmailQueue (created_date, message, type) VALUES (?,?,?)", [new Date(), JSON.stringify(message), type], callback);
	}

	function removeEmailFromQueue(id, callback)
	{
		poolQuery("DELETE FROM EmailQueue WHERE id=?", [id], callback);
	}





	// Interface
	this.init 							= init;
	this.open 							= open;
	this.close 							= close;



	this.QueryBuilder					= QueryBuilder;
	this.ensureSchema					= ensureSchema;
	this.initializeDatabase				= initializeDatabase;
	this.initData						= initData;
	this.embed 							= embed;
	this.innerEmbed						= innerEmbed;
	this.auditedQuery					= auditedQuery;
	this.runQueriesAsTransaction		= runQueriesAsTransaction;
	this.poolQuery						= poolQuery;
	this.auditedPoolQuery				= auditedPoolQuery;
	this.transactedQuery				= transactedQuery;
	this.auditedTransactedQuery			= auditedTransactedQuery;
	this.insertArrayToTable             = insertArrayToTable;
	this.removeFromTableWhere           = removeFromTableWhere;
	this.updateTable                    = updateTable;
	this.insertTranslations             = insertTranslations;
	this.insertToTable                  = insertToTable;
	this.getValidCode					= getValidCode;
	this.escape							= escape;

	this.accountSanitize				= accountSanitize;

	this.getConfiguration				= getConfiguration;
	this.updateConfiguration			= updateConfiguration;

	this.getUsersWhere					= getUsersWhere;
	this.getClientsWhere				= getClientsWhere;
	this.addUser						= addUser;
	this.updateUser						= updateUser;

	this.createPasswordResetEntry		= createPasswordResetEntry;
	this.getPasswordResetEntry			= getPasswordResetEntry;
	this.removePasswordResetEntry		= removePasswordResetEntry;

	this.getQueuedEmails					= getQueuedEmails;
	this.addEmailToQueue					= addEmailToQueue;
	this.removeEmailFromQueue				= removeEmailFromQueue;


})();



exports.Database = Database;

