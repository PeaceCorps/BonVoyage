/* jshint node: true */
'use strict';
var User = require(__dirname + '/../models/user');
var Request = require(__dirname + '/../models/request');
var Warning = require(__dirname + '/../models/warning');
var Access = require(__dirname + '/../config/access');
var countries = require(__dirname + '/../config/countries');
var DateOnly = require('dateonly');
var moment = require('moment');
var jade = require('jade');
var path = require('path');
var twilio = require('twilio');
var mailgun = require('mailgun-js');
var mailcomposer = require('mailcomposer');
var mongoose = require('mongoose');

// Attempt to load credentials for email and SMS
var dropEmail = true;
var dropSMS = true;

function envVarExists(envVar) {
	return	envVar !== null &&
					envVar !== undefined &&
					envVar !== 'undefined' &&
					typeof envVar !== 'undefined';
}

if (envVarExists(process.env.MAILGUN_KEY) &&
	envVarExists(process.env.BONVOYAGE_DOMAIN)) {
	var mailgun = mailgun({
		apiKey: process.env.MAILGUN_KEY,
		domain: 'projectdelta.io', // this is temporary
	});
	dropEmail = false;
}

if (envVarExists(process.env.TWILIO_SID) &&
	envVarExists(process.env.TWILIO_AUTH)) {
	var twilioClient = new twilio.RestClient(process.env.TWILIO_SID,
		process.env.TWILIO_AUTH);
	dropSMS = false;
}

/*
 * Helper Functions
 */
module.exports.getStartDate = function (request) {
	if (request.legs.length > 0) {
		var startDate = new DateOnly(request.legs[0].startDate);
		for (var i = 1; i < request.legs.length; i++) {
			var d = new DateOnly(request.legs[i].startDate);
			if (d < startDate) {
				startDate = d;
			}
		}

		return startDate;
	} else {
		return undefined;
	}
};

module.exports.getEndDate = function (request) {
	if (request.legs.length > 0) {
		var endDate = new DateOnly(request.legs[0].endDate);
		for (var i = 1; i < request.legs.length; i++) {
			var d = new DateOnly(request.legs[i].endDate);
			if (d > endDate) {
				endDate = d;
			}
		}

		return endDate;
	} else {
		return undefined;
	}
};

module.exports.getRequests = function (req, res, options, cb) {
	if (req.user) {
		var matchUsers = {};
		if (options && options._id) {
			matchUsers._id = mongoose.Types.ObjectId(options._id);
		}

		if (req.user.access < Access.STAFF) {
			matchUsers.volunteer = req.user._id;
		}

		if (options && options.reviewerId) {
			matchUsers.reviewer = req.reviewerId;
		}

		if (options && options.userId) {
			matchUsers.volunteer = req.userId;
		}

		Request
			.find(matchUsers)
			.populate({
				path: 'reviewer comments.user volunteer',
				select: '-hash',
			})
			.lean()
			.exec(function (err, requests) {
				if (err) {
					return cb(err);
				} else {
					// Only show requests from the same country, if staff level
					if (req.user.access == Access.STAFF) {
						requests = requests.filter(function (request) {
							return request.volunteer.countryCode == req.user.countryCode;
						});
					}

					// Add start and end date to all requests
					for (var i = 0; i < requests.length; i++) {
						requests[i].startDate = module.exports.getStartDate(requests[i]);
						requests[i].endDate = module.exports.getEndDate(requests[i]);
					}

					cb(null, requests);
				}
			});
	} else {
		cb(new Error('User not logged in!'));
	}
};

module.exports.getUsers = function (options, cb) {
	var q = (options.user !== undefined ? options.user : {});
	if (options.maxAccess !== undefined) {
		if (q.access === undefined) {
			q.access = {};
		}

		q.access.$lte = options.maxAccess;
	}

	if (options.minAccess !== undefined) {
		if (q.access === undefined) {
			q.access = {};
		}

		q.access.$gte = options.minAccess;
	}

	if (options.countryCode !== undefined) {
		q.countryCode = options.countryCode;
	}

	// Note: using lean() so that users is a JS obj, instead of a Mongoose obj
	User.find(q, '-hash').lean().exec(
		function (err, users) {
		if (err) {
			cb(err);
		} else {
			for (var i = 0; i < users.length; i++) {
				users[i].country = countries.countries[users[i].countryCode];
			}

			cb(null, users);
		}
	});
};

function formatDate(rawDate) {
	return String(rawDate);
}

module.exports.legsToString = function (legs) {
	if (legs) {
		var report = '';

		for (var i = 0; i < legs.length; i++) {
			var leg = legs[i];
			report += 'Leg ' + (i + 1) + ': ' + leg.city + ', ' +
						leg.country + '\n';
			report += 'Description: ' + leg.description + '\n';
			report += 'Companions: ' + leg.companions + '\n';
			report += 'Contact: ' + leg.contact + '\n';
			report += 'Hotel: ' + leg.hotel + '\n';
			report += 'Date: ' + formatDate(leg.startDate) + ' - ' +
						formatDate(leg.endDate) + '\n';
			report += '\n';
		}

		return report;
	} else {
		return 'Invalid request data.';
	}
};

module.exports.sendEmail = function (sendFrom, sendTo, subject, text,
	callback) {
	var data = {
		from: sendFrom,
		to: sendTo,
		subject: subject,
		text: text,
	};

	if (dropEmail === true) {
		// console.error('Email dropped.');
		if (callback) {
			callback();
		}
	} else {
		mailgun.messages().send(data, function () {
			if (callback) {
				callback();
			}
		});
	}
};

module.exports.sendTemplateEmail = function (sendFrom, sendTo, subject, template, map, callback) {
	var html = jade.renderFile(path.join(__dirname, '../email', template + '.jade'), map);

	var sendMimeCallback = function (sendError) {
		if (sendError) {
			console.log('was unable to send');
			console.log(sendError);
		}

		if (callback) {
			callback();
		}
	};

	var createMailCallback = function (sendTo, recipient) {
		return function (buildError, message) {
			if (buildError) {
				console.log(buildError);
			}

			var dataToSend = {
				to: sendTo[recipient],
				message: message.toString('ascii'),
			};

			mailgun.messages().sendMime(dataToSend, sendMimeCallback);
		};
	};

	for (var recipient in sendTo) {
		var data = {
			from: sendFrom,
			to: sendTo[recipient],
			subject: subject,
			html: html,
		};

		if (dropEmail === true) {
			// console.error('Template email dropped.');
			if (callback) {
				callback();
			}
		} else {
			var mail = mailcomposer(data);

			mail.build(createMailCallback(sendTo, recipient));
		}
	}
};

module.exports.formatDateOnly = function (date) {
	var dateonly = new DateOnly(parseInt(date + ''));
	var formatteddate = moment(dateonly.toDate()).format('MMM DD, YYYY');
	return formatteddate;
};

module.exports.sendSMS = function (sendTo, body, callback) {
	var data = {
		to: sendTo,
		from: process.env.BONVOYAGE_NUMBER,
		body: body,
	};

	if (dropSMS === true) {
		// console.error('SMS dropped.');
		if (callback) {
			callback();
		}
	} else {
		twilioClient.messages.create(data, function (err, message) {
			if (err) {
				console.log('Unable to send SMS');
			} else {
				console.log('Successfully sent SMS. SID is: ');
				console.log(message.sid);

				console.log('Sent on: ');
				console.log(message.dateCreated);
			}

			if (callback) {
				callback();
			}
		});
	}
};

module.exports.postComment = function (
	requestId, name, userId, commentMessage, cb) {
	Request.findByIdAndUpdate(requestId, {
		$push: {
			comments: {
				$each:[
					{
						name: name,
						user: userId,
						content: commentMessage,
					},
				],
			},
		},
	}, function (err) {
		cb(err);
	});

	// send notifications after comments are posted
	Request.findById(requestId, function (err, updatedRequest) {
		var reviewerId = updatedRequest.reviewer;
		var volunteerId = updatedRequest.volunteer;

		User.findById(volunteerId, function (err, volunteer) {
			if (err) {
				console.log(err);
				cb(err);
			}

			// notify the volunteer
			if (volunteer.phones) {
				for (var i = 0; i < volunteer.phones.length; i++) {
					module.exports.sendSMS(volunteer.phones[i], 'Your BonVoyage ' +
						'leave request has been modified. Please review the' +
						' details at ' + process.env.BONVOYAGE_DOMAIN +
						'/requests/' + requestId);
				}
			}

			// notify the staff
			if (reviewerId) {
				User.findById(reviewerId, function (err, reviewer) {
					if (err) {
						console.log(err);
						cb(err);
					}

					if (reviewer.phones) {
						for (var i = 0; i < reviewer.phones.length; i++) {
							module.exports.sendSMS(reviewer.phones[i], 'A BonVoyage ' +
								'leave request for ' + volunteer.name +
								' has been updated. Please review the ' +
								'details at ' + process.env.BONVOYAGE_DOMAIN +
								'/requests/' + requestId);
						}
					}
				});
			}
		});
	});
};

module.exports.formatDateOnly = function (date) {
	var dateonly = new DateOnly(parseInt(date + ''));
	var formatteddate = moment(dateonly.toDate()).format('MMM DD, YYYY');
	return formatteddate;
};

module.exports.fetchWarnings = function (callback) {
	Warning.find({}, function (err, warnings) {
		if (err) {
			console.error('An error occurred while fetching warnings:');
			console.error(err);
			return callback(err);
		} else {
			var countryToWarnings = {};

			for (var i = 0; i < warnings.length; i++) {
				var today = new DateOnly();
				if (!((warnings[i].startDate && today < warnings[i].startDate) ||
					(warnings[i].endDate && today > warnings[i].endDate))) {
					if (countryToWarnings[warnings[i].countryCode] === undefined) {
						countryToWarnings[warnings[i].countryCode] = [];
					}

					countryToWarnings[warnings[i].countryCode].push(warnings[i]);
				}
			}

			return callback(null, countryToWarnings);
		}
	});
};

module.exports.sendJSON = function (res, json) {
	res.setHeader('content-type', 'application/json');
	res.send(JSON.stringify(json));
};

module.exports.sendUnauthorized = function (res) {
	res.status(401).send('Unauthorized');
};

module.exports.sendError = function (res, err) {
	res.status(500).send({ error: err });
};
