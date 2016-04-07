/* jshint node: true */
'use strict';

require(__dirname + '/../setup');

var request = require('request');
var cheerio = require('cheerio');
var fs = require('fs');

var storeWarnings = require(__dirname + '/storeWarnings');

var countryFilePath = __dirname + '/../public/data/countryList.json';
var countryListFile = fs.readFileSync(countryFilePath, 'utf8');
var countriesDictionary = JSON.parse(countryListFile);
var allCountryCodes = Object.keys(countriesDictionary);

var COLUMNS = Object.freeze({ TYPE: 0, DATE: 1, COUNTRY: 2 });

//
// function stripTime(date) {
// 	// Convert the date to a Moment object, and
// 	// remove the time component by adjusting to the local time zone
// 	return moment(date, 'MMMM DD, YYYY').startOf('day');
// }

function matchCountryCodes(countryText) {
	// Array to track all the matched country codes
	var countryCodes = [];
	if (countryText) {
		// Some country matches are hardcoded,
		// since they don't match the countryList.json
		var matches = {
			burma: ['MM'],
			worldwide: allCountryCodes,
			'israel, the west bank and gaza': ['IL'],
			'democratic republic of the congo': ['CG'],
			'republic of south sudan': ['SD'],
		};

		// Check if the text to match is one of the hardcoded countries
		if (matches[countryText]) {
			countryCodes = matches[countryText];
		} else {
			// Otherwise search the countries dictionary for the text to match
			for (var countryCode in countriesDictionary) {
				if (countriesDictionary[countryCode].toLowerCase() == countryText) {
					countryCodes.push(countryCode);
				}
			}
		}
	}

	return countryCodes;
}

function parseText(text, index) {
	var textLowercase = text.toLowerCase();
	switch (index) {
		case COLUMNS.TYPE:
			return text; // 'Alert' or 'Warning'
		case COLUMNS.DATE:
			return text;
		case COLUMNS.COUNTRY:

			// Crop out the country from the text
			// Ex: ('Honduras Travel Warning' -> 'Honduras')
			var i = textLowercase.indexOf('travel');
			if (i != -1) {
				return textLowercase.substring(0, i - 1);
			}

			// Some special cases occur
			// (ex. 'South Pacific Tropical Cyclone Season - 2015 - 2016')
			// We should handle these eventually
			return undefined;
		default:
			throw 'Table index out of range';
	}
}

function getWarningText(warning, callback) {
	if (warning.link) {
		request(warning.link, function (error, response, body) {
			if (!error && response.statusCode == 200) {
				var $ = cheerio.load(body);
				warning.text = $('.content_par').text().trim();
				warning.textOverview = $('.callout_text').text().trim();
			}

			callback();
		});
	} else {
		callback();
	}
}

request('http://travel.state.gov/content/passports/en/alertswarnings.html',
	function (error, response, body) {
	var usWarnings = [];

	if (!error && response.statusCode == 200) {
		var $ = cheerio.load(body);
		var rowsToParse = $('tr').length;

		$('tr').each(function () {
			var rawData = [];
			var link; // Link to the full detail on the warning
			$(this).find('td').each(function (tdIndex) {
				rawData.push(parseText($(this).text(), tdIndex)); // Parse the raw text
				// Get the link that is in the country column
				if (tdIndex == COLUMNS.COUNTRY) {
					link = $(this).find('a').attr('href');

					// If further info exists, add the domain to make it a full link
					if (link) {
						link = 'http://travel.state.gov' + link;
					}
				}
			});

			var countryCodes = matchCountryCodes(rawData[COLUMNS.COUNTRY]);
			var warning = {
				countryCode: undefined,
				type: rawData[COLUMNS.TYPE],
				startDate: rawData[COLUMNS.DATE],
				link: link,
				text: undefined,
				colorClass: (rawData[COLUMNS.TYPE] === 'Alert' ? 'alert-danger' :
					'alert-warning'),
				source: 'US State Department',
			};
			getWarningText(warning, function () {
				rowsToParse--;

				// Insert this warning at each of the countries that the warning is for
				for (var i = 0; i < countryCodes.length; i++) {
					warning.countryCode = countryCodes[i];
					usWarnings.push(warning);
				}

				if (rowsToParse === 0) {
					storeWarnings(usWarnings);
				}
			});
		});
	}
});
