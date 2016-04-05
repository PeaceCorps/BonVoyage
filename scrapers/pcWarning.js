/* jshint node: true */
'use strict';

var path = require('path');
var loadEnvironment = require(path.resolve('./config/loadEnvironment'));

if (process.env.NODE_ENV !== 'production') {
	loadEnvironment();
}

var fs = require('fs');
var DateOnly = require('dateonly');
var GoogleSpreadsheet = require('google-spreadsheet');

var countryFilePath = path.resolve('./public/data/countryList.json');
var countryListFile = fs.readFileSync(countryFilePath, 'utf8');
var countriesDictionary = JSON.parse(countryListFile);
var allCountryCodes = Object.keys(countriesDictionary);

var SPREADSHEET_KEY = process.env.PC_SPREADSHEET_KEY;
var OUTPUT_FILE = path.resolve('./public/data/pcWarnings.json');

var sheet = new GoogleSpreadsheet(SPREADSHEET_KEY);

function isDef(val) {
	return val && val !== '';
}

function isValid(row) {
	return	isDef(row.country) &&
					isDef(row.type) &&
					isDef(row.message) &&
					(!isDef(row.enddate) || (new DateOnly() <= new DateOnly(row.enddate))) &&
					allCountryCodes.indexOf(row.country.toUpperCase()) > -1 &&
					['Notice', 'Travel Plan', 'Restricted'].indexOf(row.type) > -1;
}

function storeWarnings(warnings) {
	var json = JSON.stringify(warnings, null, 2);
	console.log(json);
	fs.writeFile(OUTPUT_FILE, json, function (err) {
		if (err) {
			return console.log(err);
		}
	});
}

// Worksheet IDs start at 1 -> Get first sheet
sheet.getRows(1, function (err, rows) {
	if (err) { throw err; }

	var pcWarnings = {};

	rows.map(function (row) {
		if (isValid(row)) {
			if (pcWarnings[row.country.toUpperCase()] === undefined) {
				pcWarnings[row.country.toUpperCase()] = [];
			}

			pcWarnings[row.country.toUpperCase()].push({
				type: row.type,
				textOverview: row.message,
				link: (isDef(row.link) ? row.link : undefined),
				colorClass: (row.type === 'Restricted' ? 'alert-danger' :
					(row.type === 'Travel Plan' ? 'alert-warning' : 'alert-info')),
				source: 'Peace Corps',
			});
		}
	});

	storeWarnings(pcWarnings);
});
