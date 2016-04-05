/* jshint node: true */
'use strict';

var User = require('../models/user');
var Request = require('../models/request');
var Access = require('../config/access');
var DateOnly = require('dateonly');
var moment = require('moment');
var jade = require('jade');
var path = require('path');
var fs = require('fs');
var twilio = require('twilio');
var mailgun = require('mailgun-js');
var mailcomposer = require('mailcomposer');
var mongoose = require('mongoose');
var countryFilePath = 'public/data/countryList.json';
var countryListFile = fs.readFileSync(countryFilePath, 'utf8');
var countriesDictionary = JSON.parse(countryListFile);

// Attempt to load credentials for email and SMS
var dropEmail = true;
var dropSMS = true;

if (process.env.MAILGUN_KEY !== undefined &&
	process.env.BONVOYAGE_DOMAIN !== undefined) {
	var mailgun = mailgun({
		apiKey: process.env.MAILGUN_KEY,
		domain: process.env.DOMAIN,
	});
	dropEmail = false;
}

if (process.env.TWILIO_SID !== undefined &&
	process.env.TWILIO_AUTH !== undefined) {
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
			console.log('Looking for request with id: ' + matchUsers._id);
		}

		if (req.user.access < Access.STAFF) {
			matchUsers.userId = req.user._id;
		}

		if (options && options.staffId) {
			matchUsers.staffId = req.staffId;
		}

		if (options && options.userId) {
			matchUsers.userId = req.userId;
		}

		var matchCountry = {};
		if (req.user.access == Access.STAFF) {
			matchCountry['user.countryCode'] = req.user.countryCode;
		}

		Request.aggregate([
			{
				$match: matchUsers,
			},
			{
				// JOIN with the user data belonging to each request
				$lookup: {
					from: 'users',
					localField: 'userId',
					foreignField: '_id',
					as: 'user',
				},
			},
			{
				// Only one user will ever match (emails are unique)
				// Convert the user key to a single document from an array
				$unwind: '$user',
			},
			{
				// JOIN with the user data belonging to each request
				$lookup: {
					from: 'users',
					localField: 'staffId',
					foreignField: '_id',
					as: 'staff',
				},
			},
			{
				// Only one staff will ever match (emails are unique)
				// Convert the staff key to a single document from an array
				$unwind: '$staff',
			},
			{
				$match: matchCountry,
			},
			{
				$match: (options && options.pending !== undefined ?
						{ 'status.isPending': options.pending } : {}),
			},
			{
				// Hide certain fields of the output (including password hashes)
				$project: {
					userId: true,
					staffId: true,
					counterpartApproved: true,
					comments: true,
					legs: true,
					timestamp: true,
					status: true,
					user: {
						name: true,
						email: true,
						phone: true,
						access: true,
						countryCode: true,
					},
					staff: {
						name: true,
						email: true,
						phone: true,
						access: true,
						countryCode: true,
					},
				},
			},
		], function (err, requests) {
			if (err) {
				return cb(err);
			} else {
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

	console.log(q);

	// Note: using lean() so that users is a JS obj, instead of a Mongoose obj
	User.find(q, 'access name email phone _id countryCode').lean().exec(
		function (err, users) {
		if (err) {
			cb(err);
		} else {
			for (var i = 0; i < users.length; i++) {
				users[i].country = countriesDictionary[users[i].countryCode];
			}

			cb(null, users);
		}
	});
};

module.exports.sendEmail = function (sendFrom, sendTo, subject, text,
	callback) {
	var data = {
		from: sendFrom,
		to: sendTo,
		subject: subject,
		text: text,
	};

	if (dropEmail) {
		console.error('Email dropped. Email data:');
		console.error(data);
		if (callback) {
			callback();
		}
	} else {
		mailgun.messages().send(data, function (err, body) {
			console.log(body);

			if (callback) {
				callback();
			}
		});
	}
};

module.exports.sendTemplateEmail = function (sendFrom, sendTo, subject,
	template, map, callback) {

	var html = jade.renderFile(path.join(__dirname, '../email',
		template + '.jade'), map);

	var data = {
		from: sendFrom,
		to: sendTo,
		subject: subject,
		html: html,
	};

	if (dropEmail) {
		console.error('Email dropped. Email data:');
		console.error(data);
		if (callback) {
			callback();
		}
	} else {
		var mail = mailcomposer(data);

		mail.build(function (buildError, message) {
			if (buildError) {
				console.log(buildError);
			}

			var dataToSend = {
				to: sendTo,
				message: message.toString('ascii'),
			};

			mailgun.messages().sendMime(dataToSend, function (sendError, body) {
				if (sendError) {
					console.log(sendError);
				}

				if (body) {
					console.log('Email data:' + body);
				}

				if (callback) {
					callback();
				}
			});
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
						userId: userId,
						content: commentMessage,
					},
				],
			},
		},
	}, function (err) {
		cb(err);
	});
};

module.exports.formatDateOnly = function (date) {
	var dateonly = new DateOnly(parseInt(date + ''));
	var formatteddate = moment(dateonly.toDate()).format('MMM DD, YYYY');
	console.log(formatteddate);
	return formatteddate;
};

module.exports.sendSMS = function (sendTo, body, callback) {
	var data = {
		to: sendTo,
		from: process.env.BONVOYAGE_NUMBER,
		body: body,
	};

	if (dropSMS) {
		console.error('SMS dropped. SMS data:');
		console.error(data);
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
