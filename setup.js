/* jshint node: true */
'use strict';

if (process.env.DID_SETUP !== true) {

	if (process.env.NODE_ENV !== 'production') {
		try {
			var environment = require(__dirname + '/config/environment.js');
			var envVariables = Object.keys(environment);

			for (var i = 0; i < envVariables.length; i++) {
				process.env[envVariables[i]] = environment[envVariables[i]];
			}
		} catch (e) {
			console.error('Unable to locate environment variable in: ' +
				'"config/environment.js"');
			console.error('You may need to create an environment configuration from ' +
				'"config/environment.defaults.js".');
			process.exit(1);
		}
	}

	process.env.DID_SETUP = true;
}
