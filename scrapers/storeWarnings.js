/* jshint node: true */
/* jshint loopfunc: true */
'use strict';

require(__dirname + '/../setup');

var mongoose = require('mongoose');
var uuid = require('node-uuid');
var Warning = require(__dirname + '/../models/warning');
var Request = require(__dirname + '/../models/request');
var User = require(__dirname + '/../models/user');
var mongoConnection = require(__dirname + '/../config/mongoConnection');
var helpers = require(__dirname + '/../routes/helpers');

mongoose.connect(mongoConnection.getConnectionString());

function removeAll(newBatchUUID) {
	console.log('Removing all warnings except batch: ' + newBatchUUID);
	Warning.find({ batchUUID: { $ne: newBatchUUID } })
		.remove()
		.exec(function (err, response) {
		if (err) {
			console.error('An error occurred while attempting to remove ' +
				' warnings.');
			throw err;
		} else {
			console.log('Removed ' + response.result.n + ' warnings.');
			mongoose.connection.close();
		}
	});
}

function notifyVolunteerStaff(request) {
	var volunteerId = request.volunteer;
	var staffId = request.reviewer;

	var volunteerMessage = 'A new travel warning has been issued that ' +
		'may affect your Peace Corps volunteer\'s leave request.';
	var staffMessage = 'A new travel warning has been issued that ' +
		'may affect a Peace Corps leave request you have approved';

	User.findById(volunteerId, function (err, volunteer) {
		if (volunteer) {
			var phones = volunteer.phones;

			if (phones) {
				for (var i = 0; i < phones.length; i++) {
					helpers.sendSMS(phones[i], volunteerMessage);
				}
			}
		}
	});

	User.findById(staffId, function (err, staff) {
		if (staff) {
			var phones = staff.phones;

			if (phones) {
				for (var i = 0; i < phones.length; i++) {
					helpers.sendSMS(phones[i], staffMessage);
				}
			}
		}
	});
}

function notifyAll(requests) {
	for (var i = 0; i < requests.length; i++) {
		notifyVolunteerStaff(requests[i]);
	}
}

function onFinish(batchUUID, notifyWarnings) {
	// notifyWarnings is now populated
	for (var j = 0; j < notifyWarnings.length; j++) {
		if (notifyWarnings[j]) {
			var startDate = notifyWarnings[j].startDate;

			// if the request has leg that visits the country and has start date after the start date
			// of the warning, then notify
			Request.find({ legs:
				{ $elemMatch:
					{
						startDate: { $gte: startDate },
						countryCode: notifyWarnings[j].countryCode,
					},
				},
			}, function (err, requests) {
				if (err) {
					console.error(err);
				}

				if (requests) {
					notifyAll(requests);
				}
			});
		}
	}

	// removing all old warnings
	removeAll(batchUUID);
}

var storeWarnings = function (warnings) {
	var batchUUID = uuid.v1();
	var count = warnings.length;
	var notifyWarnings = [];

	if (count > 0) {
		var source = warnings[0].source;
		console.log('Inserting ' + count + ' warnings (Batch: ' + batchUUID + ')');

		for (var i = 0; i < warnings.length; i++) {
			warnings[i].batchUUID = batchUUID;
			count--;

			Warning.findOneAndUpdate({
				countryCode: warnings[i].countryCode,
				textOverview: warnings[i].textOverview,
				colorClass: warnings[i].colorClass,
				source: warnings[i].source,
			},
			warnings[i],
			{ upsert: true },
			function (err, isExistingWarning) {
				if (err) {
					console.error('(Batch: ' + batchUUID +
						'): Inserting the following warning failed:');
					console.error(isExistingWarning);
					console.error(err);
				}

				if (isExistingWarning) {
					console.log('Updating an existing warning.');
				} else {
					notifyWarnings.push(warnings[i]);
				}
			});
		}
		if (count === 0) {
			onFinish(batchUUID, notifyWarnings);
		}
	}
};

module.exports = storeWarnings;
