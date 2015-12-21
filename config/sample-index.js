//
// The configuration options of the server
//
/**
 * General Server Configuration
 */
var DEBUGQUERIES = false;
var DEBUG= false;
var PUBLIC_PORT = 9001;		//Port used by public to access the site
var AUTOMATION_PORT = 9000;
var PROTOCOL = "https";
var HOST = "beta-admin.knorex.asia";
var PORT = "9003"; 			//Port used by nginx upstream
var WebURL = PROTOCOL+"://"+HOST;

exports.server = {
    DEBUGQUERIES : DEBUGQUERIES,
    DEBUG: DEBUG,
    PUBLIC_PORT : PUBLIC_PORT,		//Port used by public to access the site
    PROTOCOL : PROTOCOL,
    HOST : HOST,
    PORT : PORT, 			//Port used by nginx upstream
    WebURL : WebURL,
    AUTOMATION_PORT : AUTOMATION_PORT,

    system:
    {
        secretResetLifespan: 24,
        passwordResetLifespan:	24,
        MandrillKey:			"tluFDn_9dIdq5uKQSDwAMA",
        internalEmailUser:		"",
        internalEmailPass:		"",
        internalEmailHost:		"mail.singnet.com.sg",
        senderEmail:			"admin@knorex.com",
        senderEmailName:		"Admin",
        contactEmail:			"customer_service@knorex.com",
        homeUrl:				"https://www.knorex.com",
        OpenExchangeRatesKey:   "d0f945e90acb4ce6be4ad95a61817366",
        OpenExchangeRatesUrl:   "http://openexchangerates.org/api/latest.json?app_id=",
        dailyCheckInterval:     24,
        lastDailyCheck:         new Date(2014, 9, 1),
        lastCurrencyUpdate:     new Date(2014, 9, 1),
        unpaidTimeout:          0
    },

    web:
    {
        passwordResetUrl:		WebURL+"/api/passwordReset/",
        secretResetUrl:         WebURL+"/secret-reset",
        activateAccountUrl:     WebURL+"/api/activateAccount/"
    },

    database:
    {
        dbName:					"knxadmin",
        host:					"127.0.0.1",				//"192.168.50.5",
        port:					"3306",
        user:					"knx_admin",
        password:				"Bc6nxvZnv7",
        timezone:				"Z",
        poolSize:				100,
        ensureSchema:			true,				// make sure there is always an archive entry for each item in main tables
        ensureContraints:		true,				// create new constraints
        ensureTriggers:			true,				// recreate triggers (drop and create new)
        ensureArchiveData:		true,				// put whatever data is in the database into Audit tables (if it wasn't there)
        ensureData:				true,				// ensure initial data set is in the database (default currencies, languages etc)
        ensureProcedures:		true,				// create procedures
        encryptionKey:			'secret'
    },
    mongo:
    {
        host:					"127.0.0.1",
        port:					"27017",
        user:					"",
        password:				"",
        dbName:					"knxadmin"

    },
    constants:
    {
        poolIdleTimeout:		10000,		// after how much time will the db pool connection be forcibly returned to the pool
        keepAliveInterval:		600000,		// 5 minutes
        maxSimultaneousPaymentRequests: 10
    },

    /**
     * Session configuration
     *
     * maxAge - The maximum age in milliseconds of the session.  Use null for
     * web browser session only.  Use something else large like 3600000 * 24 * 7 * 52
     * for a year.
     * secret - The session secret that you should change to what you want
     * dbName - The database name if you're using Mongo
     */
    session :
    {
        maxAge: 3600000 * 24,
        secret: "Kn4bO04Ad",
        dbName: "knxadmin",
        collectionName: "sessions"
    },

    /**
     * Configuration of access tokens.
     *
     * expiresIn - The time in seconds before the access token expires
     * calculateExpirationDate - A simple function to calculate the absolute
     * time that th token is going to expire in.
     * authorizationCodeLength - The length of the authorization code
     * accessTokenLength - The length of the access token
     * refreshTokenLength - The length of the refresh token
     */
    token : {
        expiresIn: 3600 * 24,
        calculateExpirationDate: function ()
        {
            return new Date(new Date().getTime() + (this.expiresIn * 1000));
        },
        authorizationCodeLength: 16,
        accessTokenLength: 256,
        refreshTokenLength: 256,
        collectionName: "tokens"
    }
}
