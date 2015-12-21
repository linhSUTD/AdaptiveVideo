/**
 * Created with JetBrains WebStorm.
 * User: phonezawphyo
 * Date: 15/7/13
 * Time: 1:04 PM
 * To change this template use File | Settings | File Templates.
 */

/**
 * This module will check if the exact version of modules are installed and install them if the version is different
 * If a newer or older version exists for a module, it will be replaced with the defined version.
 *
 * It requires "npm install npm" to be run once. Make sure to install it without -g (global) flag,
 * otherwise require("npm") will not work
 */
var npm					= require("npm");

var moduleList = [
	{ name: 'express', 							version: '3.11.0' },
	{ name: 'async', 							version: '0.9.0' },
	{ name: 'ejs', 								version: '0.7.2' },
	{ name: 'oauth2orize', 						version: '0.1.0' },
	{ name: 'passport', 						version: '0.1.18' },
	{ name: 'passport-local', 					version: '0.1.6' },
	{ name: 'passport-http', 					version: '0.2.2'},
	{ name: 'passport-http-bearer', 			version: '0.2.1' },
	{ name: 'passport-oauth2-client-password', 	version: '0.1.1' },
	{ name: 'connect-ensure-login', 			version: '0.1.1' },
	{ name: 'connect-mongo', 					version: '0.3.3' },
	{ name: 'mongodb', 							version: '1.3.23' },
	{ name: 'cluster',							version: '0.7.7' },
	{ name: 'mysql',							version: '2.3.2' },
	{ name: 'mysql-queues', 					version: '1.0.0' },
	{ name: 'colors', 							version: '0.6.2'},
];

exports.init = function (callback)
{
	npm.load({}, function (er)
	{
		if (er) return handlError(er)

		npm.on("log", function (message)
		{
			console.log(message.blue);
		});

		var silent = true;

		npm.commands.ls([], silent, function (err, fullDependencies, liteDependencies)
		{
			if (er) return console.error("Failed to list installed node_module(s)", er);

			var dependencies = liteDependencies.dependencies;

			moduleList = moduleList.filter(function (m)
			{
				var dependency = dependencies[m.name];
				var meetsVersion = dependency && (!m.version || dependency.version == m.version);
				return !meetsVersion;
			});

			//if version is null, install the latest version, else, install the specified version
			moduleList = moduleList.map(function (m) { return m.version ? m.name + "@" + m.version : m.name; });

			if (moduleList.length)
			{
				console.log("Node modules to install:", moduleList);

				npm.commands.install(moduleList, function (er, data) {
					if (er) return console.error("Failed to install node_module(s)", er);

					callback();
				})

			}
			else
			{
				console.log("All node modules met the required versions");
				callback();
			}
		});
	});
}