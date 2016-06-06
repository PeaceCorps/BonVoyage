/* jshint node: true */
/**
 * This file provides default configurations.
 *
 * Copy this file and rename it as 'environment.js' and node will overwrite
 * the corresponding environment variables with your configuration.
 *
 * Note: you can add any environment variables that you would like available
 */

module.exports = {
	SESSION_SECRET: 'drtwxroGWs9f93AQWbALN8Q7cvgNe4',

	// For development
	MONGO_DEV_CONNECTION_STRING: 'mongodb://localhost:27017/bonvoyage',
	DEV_PORT: '3000',

	// For production
	MONGO_PROD_CONNECTION_STRING: '',
	PROD_PORT: '3000',

	// For testing
	MONGO_TEST_CONNECTION_STRING: 'mongodb://localhost:27017/bonvoyage_tests',
	TEST_PORT: '3001',

	// The Google Spreadsheet key where the Peace Corps Leave Requests can be found
	PC_SPREADSHEET_KEY: '',

	// Leaving the following three config options as undefined will cause the app
	// to silently drop SMS and email. Simply set them to the corresponding
	// Twilio or Mailgun keys and the app will use them.
	TWILIO_AUTH: undefined,
	TWILIO_SID: undefined,
	MAILGUN_KEY: undefined,

	BONVOYAGE_EMAIL: 'bonvoyage@peacecorps.me',

	// The public-facing domain where this site is hosted: this will be seen
	// when links are provided in email and SMS.
	BONVOYAGE_DOMAIN: 'http://localhost:3000',

	// The phone number that Twilio will send texts from.
	BONVOYAGE_NUMBER: '+11234567890',
};
