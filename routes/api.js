/* jshint node: true */
/* jshint loopfunc:true */
'use strict';

var express = require('express');
var router = express.Router();
var User = require(__dirname + '/../models/user');
var Request = require(__dirname + '/../models/request');
var Token = require(__dirname + '/../models/token');
var Access = require(__dirname + '/../config/access');
var countries = require(__dirname + '/../config/countries');
var tokenTypes = require(__dirname + '/../config/token-types');
var randtoken = require('rand-token');
var helpers = require('./helpers');
var async = require('async');
var DateOnly = require('dateonly');
var Converter = require('csvtojson').Converter;
var validator = require('email-validator');
var phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();

// For setting default arguments
function ifDefined(a, b) {
	return (a === undefined ? b : a);
}

/*
 * Handle Parameters
 */
router.handleRequestId = function (req, res, next) {
	var requestId = req.params.requestId;
	helpers.getRequests(req, res, { _id: requestId },
		function (err, requests) {
		if (err) {
			return next(err);
		} else {
			if (requests.length > 0) {
				req.request = requests[0];
			} else {
				req.request = null;
			}

			return next();
		}
	});
};

router.handleUserId = function (req, res, next) {
	var userId = req.params.userId;
	helpers.getUsers({ user: { _id: userId } }, function (err, users) {
		if (err) {
			return next(err);
		} else {
			if (users.length > 0) {
				req.paramUser = users[0];
			} else {
				req.paramUser = null;
			}

			return next();
		}
	});
};

/*
 * GET Requests
 */
router.getRequests = function (req, res) {
	if (req.request !== undefined) {
		return helpers.sendJSON(res, req.request);
	}

	helpers.getRequests(req, res, undefined, function (err, requests) {
		if (err) {
			console.error(err);
		}

		return helpers.sendJSON(res, requests);
	});
};

router.getPendingRequests = function (req, res) {
	helpers.getRequests(req, res, true, function (err, requests) {
		if (err) {
			console.error(err);
		}

		return helpers.sendJSON(res, requests);
	});
};

router.getPastRequests = function (req, res) {
	helpers.getRequests(req, res, false, function (err, requests) {
		if (err) {
			console.error(err);
		}

		return helpers.sendJSON(res, requests);
	});
};

router.getUsers = function (req, res) {
	if (req.params.userId !== undefined) {
		return helpers.sendJSON(res, req.paramUser);
	}

	var maxAccess = parseInt(req.query.maxAccess);
	if (isNaN(maxAccess)) {
		maxAccess = Access.ADMIN;
	}

	var minAccess = parseInt(req.query.minAccess);
	if (isNaN(minAccess)) {
		minAccess = Access.VOLUNTEER;
	}

	var countryCode = countries.validateCountry(req.query.country);

	helpers.getUsers({
		maxAccess: maxAccess,
		minAccess: minAccess,
		countryCode:
			(req.user.access == Access.VOLUNTEER ? req.user.countryCode : countryCode),
	}, function (err, users) {
		if (err) {
			console.error(err);
		}

		return helpers.sendJSON(res, users);
	});
};

router.getWarnings = function (req, res) {
	helpers.fetchWarnings(function (err, requests) {
		if (err) {
			console.error(err);
		}

		return helpers.sendJSON(res, requests);
	});
};

/*
 * POST Requests
 */

// Verify that the request is valid while converting it
// over into the proper form to save as a new request
function validateRequestSubmission(req, res, failureRedirect, cb) {
	var userId = req.user._id;

	// Staff will select a user to submit a request for on the form
	if (req.user.access >= Access.STAFF) {
		userId = req.body.volunteer;
		if (userId === undefined || userId === '') {
			req.session.submission = req.body;
			req.flash('submissionFlash', {
				text: 'You must select a volunteer to submit this request for.',
				class: 'danger',
			});
			helpers.sendJSON(res, { redirect: failureRedirect });
			return cb(null);
		}
	}

	var reviewerId = req.body.reviewer;

	if (reviewerId === undefined || reviewerId === '') {
		req.session.submission = req.body;
		req.flash('submissionFlash', {
			text: 'You must select a reviewer to assign this leave request to.',
			class: 'danger',
		});
		helpers.sendJSON(res, { redirect: failureRedirect });
		return cb(null);
	}

	// Verify that the volunteer exists
	helpers.getUsers({
		user: {
			_id: userId,
		},
	}, function (err, volunteers) {
		if (err) {
			console.error(err);
			req.session.submission = req.body;
			req.flash('submissionFlash', {
				text: 'An error has occrured while attempting to process your request. ' +
					'Please try again later.',
				class: 'danger',
			});
			helpers.sendJSON(res, { redirect: failureRedirect });
		} else if (volunteers.length > 0) {
			// Verify that the volunteer exists
			helpers.getUsers({
				user: {
					_id: reviewerId,
				},
			}, function (err, reviewers) {
				if (err) {
					console.error(err);
					req.session.submission = req.body;
					req.flash('submissionFlash', {
						text: 'An error has occrured while attempting to process your request. ' +
							'Please try again later.',
						class: 'danger',
					});
					helpers.sendJSON(res, { redirect: failureRedirect });
				} else if (reviewers.length > 0) {
					var legs = [];
					var visitedCountries = [];
					for (var i = 0; i < req.body.legs.length; i++) {
						var leg = req.body.legs[i];
						var start = new DateOnly(leg.startDate);
						var end = new DateOnly(leg.endDate);

						if (start > end) {
							req.session.submission = req.body;
							req.flash('submissionFlash', {
								text: 'The start date you entered for leg #' +
									(i + 1) + ' comes after the end date.',
								class: 'danger',
							});
							helpers.sendJSON(res, { redirect: failureRedirect });
							return cb(null);
						} else if (countries.codeList.indexOf(leg.country) == -1) {
							req.session.submission = req.body;
							req.flash('submissionFlash', {
								text: 'The country that you have selected for leg #' +
									(i + 1) + ' is not a valid country.',
								class: 'danger',
							});
							helpers.sendJSON(res, { redirect: failureRedirect });
							return cb(null);
						} else if (leg.city === '') {
							req.session.submission = req.body;
							req.flash('submissionFlash', {
								text: 'The city that you entered for leg #' +
									(i + 1) + ' is invalid',
								class: 'danger',
							});
							helpers.sendJSON(res, { redirect: failureRedirect });
							return cb(null);
						} else {
							legs.push({
								startDate: start,
								endDate: end,
								city: leg.city,
								country: countries.countries[leg.country],
								countryCode: leg.country,
								hotel: leg.hotel,
								contact: leg.contact,
								companions: leg.companions,
								description: leg.description,
								addedLegCount: leg.addedLegCount,
							});

							if (visitedCountries.indexOf(leg.country) == -1) {
								visitedCountries.push(leg.country);
							}
						}
					}

					if (req.body.counterpartApproved === 'false') {
						req.session.submission = req.body;
						req.flash('submissionFlash', {
							text: 'You must have approval from your counterpart in order ' +
							'to submit this leave request.',
							class: 'danger',
						});
						helpers.sendJSON(res, { redirect: failureRedirect });
						return cb(null);
					} else if (legs.length > 0) {
						cb({
							requestData: {
								volunteer: userId,
								reviewer: reviewerId,
								status: {
									isPending: true,
									isApproved: false,
								},
								legs: legs,
								counterpartApproved: true,
							},
							countries: countries,
							users: volunteers,
							reviewers: reviewers,
						});
					} else {
						req.session.submission = req.body;
						req.flash('submissionFlash', {
							text: 'An error has occurred while trying to save ' +
								'this request. Please try again.',
							class: 'danger',
						});
						helpers.sendJSON(res, { redirect: failureRedirect });
						return cb(null);
					}
				} else {
					req.session.submission = req.body;
					req.flash('submissionFlash', {
						text: 'The reviewer that you assigned could not be found.',
						class: 'danger',
					});
					helpers.sendJSON(res, { redirect: failureRedirect });
					return cb(null);
				}
			});
		} else {
			req.session.submission = req.body;
			req.flash('submissionFlash', {
				text: 'The volunteer that you selected could not be found.',
				class: 'danger',
			});
			helpers.sendJSON(res, { redirect: failureRedirect });
			return cb(null);
		}
	});
}

router.postUpdatedRequest = function (req, res) {
	var failureRedirect = '/requests/' + req.request._id + '/edit';
	var successRedirect = '/requests/' + req.request._id;
	validateRequestSubmission(req, res, failureRedirect, function (data) {
		if (data !== null) {
			// Calculate the difference between data and the existing data (req.request)
			var changesMade = false;
			var comment = req.user.name +
				' updated this request with the following changes:\n';

			// Detect changes in any of the legs
			// List of indexes (addedLegCount) that were not removed
			var originalLegIndexesFound = [];
			var legBefore;
			var legAfter;

			// Look for added or modified legs
			for (var i = 0; i < data.requestData.legs.length; i++) {
				legAfter = data.requestData.legs[i];
				var addedLegCount = legAfter.addedLegCount;
				if (addedLegCount >= req.request.legs.length) {
					// This leg was added
					comment += '- Added a new trip leg to ' +
						legAfter.country +
						' from ' + helpers.formatDateOnly(legAfter.startDate) +
						' to ' + helpers.formatDateOnly(legAfter.endDate) + '.\n';
					changesMade = true;
				} else {
					// Compare the request before and after
					legBefore = req.request.legs[addedLegCount];
					var didModify = false;
					var modifiedComment = '- Modifed the trip leg to ' +
						legAfter.country +
						' from ' + helpers.formatDateOnly(legAfter.startDate) +
						' to ' + helpers.formatDateOnly(legAfter.endDate) + '.\n';
					if (legBefore.startDate != legAfter.startDate) {
						modifiedComment += '	Changed the start date from ' +
							helpers.formatDateOnly(legBefore.startDate) + ' to ' +
							helpers.formatDateOnly(legAfter.startDate) + '.\n';
						didModify = true;
					}

					if (legBefore.endDate != legAfter.endDate) {
						modifiedComment += '	Changed the end date from ' +
							helpers.formatDateOnly(legBefore.endDate) + ' to ' +
							helpers.formatDateOnly(legAfter.endDate) + '.\n';
						didModify = true;
					}

					if (legBefore.city != legAfter.city) {
						modifiedComment += '	Changed the city from ' +
							legBefore.city + ' to ' +
							legAfter.city + '.\n';
						didModify = true;
					}

					if (legBefore.country != legAfter.country) {
						modifiedComment += '	Changed the country from ' +
							legBefore.country + ' to ' +
							legAfter.country + '.\n';
						didModify = true;
					}

					if (legBefore.hotel != legAfter.hotel) {
						modifiedComment += '	Changed the hotel information from "' +
							legBefore.hotel + '" to "' +
							legAfter.hotel + '".\n';
						didModify = true;
					}

					if (legBefore.contact != legAfter.contact) {
						modifiedComment += '	Changed the contact information from "' +
							legBefore.contact + '" to "' +
							legAfter.contact + '".\n';
						didModify = true;
					}

					if (legBefore.companions != legAfter.companions) {
						modifiedComment += '	Changed the companions information from "' +
							legBefore.companions + '" to "' +
							legAfter.companions + '".\n';
						didModify = true;
					}

					if (legBefore.description != legAfter.description) {
						modifiedComment += '	Changed the description from "' +
							legBefore.description + '" to "' +
							legAfter.description + '".\n';
						didModify = true;
					}

					if (didModify) {
						comment += modifiedComment;
						changesMade = true;
					}
				}
			}

			// Look for removed legs
			for (i = 0; i < req.request.legs.length; i++) {
				legBefore = req.request.legs[i];
				if (!originalLegIndexesFound.indexOf(i)) {
					// This leg was removed
					comment += '- Removed the trip leg to ' +
						legBefore.country +
						' from ' + helpers.formatDateOnly(legBefore.startDate) +
						' to ' + helpers.formatDateOnly(legBefore.endDate) + '.\n';
					changesMade = true;
				}
			}

			// Detect if the user submitted for changed
			if (data.users.length > 0 &&
				!data.users[0]._id.equals(req.request.volunteer._id)) {
				comment += '- Changed Peace Corps volunteer from ' +
					req.request.user.name + ' to ' + data.users[0].name + '\n';
				changesMade = true;
			}

			// Detect if the staff assigned has changed
			if (data.reviewers.length > 0 && (!req.request.reviewer ||
				!data.reviewers[0]._id.equals(req.request.reviewer._id))) {
				if (req.request.reviewer !== null) {
					comment += '- Changed assigned reviewer from ' + req.request.reviewer.name +
						' to ' + data.reviewers[0].name + '\n';
				} else {
					comment += '- Unarchived and assigned ' + data.reviewers[0].name + ' as the reviewer\n';
				}

				changesMade = true;
			}

			if (changesMade) {

				// Submit a comment with these changes
				helpers.postComment(req.request._id, 'Administrator', null, comment,
				function (err) {
					if (err) {
						console.error({
							error: err,
						});
						req.flash('approvalFlash', {
							text: 'An error has occurred while trying to ' +
								'update this request. Please try again.',
							class: 'danger',
						});
						helpers.sendJSON(res, { redirect: failureRedirect });
					} else {
						// Update the database with the edited request
						Request.update({ _id: req.request._id }, data.requestData,
							function (err) {
							if (err) {
								req.session.submission = req.body;
								req.flash('submissionFlash', {
									text: 'An error has occurred while trying to ' +
										'update this request. Please try again.',
									class: 'danger',
								});
								helpers.sendJSON(res, { redirect: failureRedirect });
							}
						});

						req.flash('approvalFlash', {
							text: 'This leave request has successfully been updated.',
							class: 'success',
						});
						helpers.sendJSON(res, { redirect: successRedirect });
					}
				});
			} else {
				// No changes have been made --
				// we will jsut rediect them to the approval page

				// req.flash('approvalFlash', {
				// 	text: 'This leave request has successfully been updated.',
				// 	class: 'success',
				// });
				helpers.sendJSON(res, { redirect: successRedirect });
			}
		}
	});
};

router.postRequest = function (req, res) {
	validateRequestSubmission(req, res, '/dashboard/submit', function (data) {
		if (data !== null) {
			var newRequest = new Request(data.requestData);

			newRequest.save(function (err, obj) {
				if (err) {
					req.session.submission = req.body;
					req.flash('submissionFlash', {
						text: 'An error has occurred while trying to ' +
							'save this request. Please try again.',
						class: 'danger',
					});
					helpers.sendJSON(res, { redirect: '/dashboard/submit' });
				} else {
					// asynchronous
					// send SMS notification to a staff
					process.nextTick(function () {
						for (var i = 0; i < data.countries.length; i++) {
							User.find({
								access: Access.STAFF,
								countryCode: data.countries[i],
							},
							function (err, docs) {
								if (err) {
									console.error(err);
								} else {
									for (var j = 0; j < docs.length; j++) {
										var msg = 'A request by ' +
											data.users[0].name + ' is waiting ' +
											'for your approval on BonVoyage. ' +
											process.env.BONVOYAGE_DOMAIN + '/login';

										if (docs[j].phones) {
											for (var i = 0; i < docs[j].phones.length; i++) {
												helpers.sendSMS(docs[j].phones[i], msg);
											}
										} else {
											console.log(docs[j].name +
											' does not have a phone number');
										}
									}
								}
							});
						}
					});

					req.flash('dashboardFlash', {
						text: 'Request successfully saved.',
						class: 'success',
						link: {
							url: '/requests/' + obj._id,
							text: 'View Request.',
						},
					});
					helpers.sendJSON(res, { redirect: '/dashboard' });
				}
			});
		}
	});
};

router.postApproval = function (req, res) {
	var id = req.params.requestId;
	var approvalFormBody = req.body;
	console.log(approvalFormBody);
	var newReviewer = approvalFormBody.reviewer === 'none' ? null : approvalFormBody.reviewer;
	Request.findByIdAndUpdate(id, {
		$set: {
			'status.isPending': newReviewer !== null,
			'status.isApproved': approvalFormBody.approval,
			reviewer: newReviewer,
		},
	}, {
		new: true,
		runValidators: true,
	})
	.populate('reviewer volunteer')
	.exec(function (err, doc) {
		if (err) {
			return helpers.sendError(res, err);
		}

		// Build the comment message
		var commentMessage;
		if (newReviewer !== null) {
			commentMessage = req.user.name + ' has ' + (approvalFormBody.approval ? 'approved' : 'denied') +
			' and re-assigned this request to ' + doc.reviewer.name + '.';
		} else {
			commentMessage = req.user.name + ' has ' + (approvalFormBody.approval ? 'approved' : 'denied') +
			' and archived this request.';
		}

		// Function to redirect user after submitting optional comment
		function end() {
			// Submit the comment about this approval
			helpers.postComment(doc._id, 'Administrator', null, commentMessage, function () {
				// Send notifications
				var sendTo = [doc.volunteer.email];
				var subject = 'Peace Corps BonVoyage Request ' + (approvalFormBody.approval ? 'Approved' : 'Denied');
				var details = helpers.legsToString(doc.legs);

				var map = {
					name: doc.volunteer.name.split(' ')[0],
					volunteer: 'Your',
					details: details,
					button: process.env.BONVOYAGE_DOMAIN + '/requests/' + id,
				};

				// asynchronous
				process.nextTick(function () {
					helpers.sendTemplateEmail(sendTo, subject,
						(approvalFormBody.approval ? 'approve' : 'deny'), map);

					if (doc.volunteer.phones) {
						for (var i = 0; i < doc.volunteer.phones.length; i++) {
							helpers.sendSMS(doc.volunteer.phones[i], 'Your BonVoyage ' +
								'leave request received ' + (approvalFormBody.approval ? 'an approval.' : 'a denial.'));
						}
					}
				});

				req.flash('dashboardFlash', {
					text: 'The request has been ' + (approvalFormBody.approval ? 'approved' : 'denied') +
						' and ' + (newReviewer === null ? 'archived.' : 're-assigned.'),
					class: 'success',
					link: {
						url: '/requests/' + id,
						text: 'View Request.',
					},
				});
				helpers.sendJSON(res, { redirect: '/dashboard' });
			});
		}

		if (approvalFormBody.comment.length > 0) {
			helpers.postComment(doc._id, req.user.name, req.user._id, approvalFormBody.comment, end);
		} else {
			end();
		}
	});
};

router.postComments = function (req, res) {
	var id = req.params.requestId;
	helpers.postComment(id, req.user.name, req.user._id, req.body.content,
	function (err) {
		if (err) {
			console.log('err on api');
			console.log(err);
			return helpers.sendError(res, err);
		}

		req.flash('approvalFlash', {
			text: 'Your comment has been added.',
			class: 'success',
		});
		helpers.sendJSON(res, { redirect: '/requests/' + id });
	});
};

router.reset = function (req, res) {
	var email = req.body.email;

	// first check if email is registered
	User.findOne({ email: email }, function (err, user) {
		if (!err && user) {
			// remove the existing password reset tokens
			Token.remove({ user: user._id, tokenType: tokenTypes.PASSWORD_RESET }, function (err) {
				if (err) {
					console.log(err);
				}

				var token = randtoken.generate(64);

				Token.create({
					token: token,
					user: user._id,
					tokenType: tokenTypes.PASSWORD_RESET,
				}, function (err) {
					if (err) {
						req.flash('resetFlash', {
							text: 'Failed to generate an email reset token.',
							class: 'danger',
						});
						req.session.submission = { email: email };
						helpers.sendJSON(res, { redirect: '/reset' });
					}

					var sendTo = [user.email];
					var subject = 'Peace Corps BonVoyage Password Reset Request';
					var map = {
						name: user.name.split(' ')[0],
						button: process.env.BONVOYAGE_DOMAIN + '/reset/' + token,
					};

					// asynchronous
					process.nextTick(function () {
						helpers.sendTemplateEmail(sendTo, subject, 'password', map);
					});

					req.flash('loginFlash', {
						text: 'Instructions to reset your password have been ' +
							'sent to your email address.',
						class: 'success',
					});
					helpers.sendJSON(res, { redirect: '/login' });
				});
			});
		} else {
			req.flash('resetFlash', {
				text: 'The account you are looking for could not be found.',
				class: 'danger',
			});
			req.session.submission = { email: email };
			helpers.sendJSON(res, { redirect: '/reset' });
		}
	});
};

router.resetValidator = function (req, res) {
	var token = req.params.token;
	var newPassword = req.body.newPassword;
	var confirmPassword = req.body.confirmPassword;

	if (newPassword == confirmPassword && newPassword !== '') {
		// validate token
		// modify the password
		Token.findOneAndRemove({
			token: token,
			tokenType: tokenTypes.PASSWORD_RESET,
		}, function (err, validToken) {
			if (err) {
				req.flash('resetFlash', {
					text: 'Invalid token. Please request to reset your password again.',
					class: 'danger',
				});
				helpers.sendJSON(res, { redirect: '/reset' });
			} else {
				// token has been found
				if (validToken) {

					User.findById(validToken.user, function (err, account) {
						if (!err && account) {
							account.hash = newPassword;

							account.save(function (err) {
								if (err) {
									// couldn't save the user
									req.flash('loginFlash', {
										text: 'An error occurred while resetting your password. Please retry.',
										class: 'danger',
									});
									helpers.sendJSON(res, { redirect: '/login' });
								}

								req.flash('loginFlash', {
									text: 'Your password has been successfully updated.',
									class: 'success',
								});
								helpers.sendJSON(res, { redirect: '/login' });
							});
						} else {
							req.flash('loginFlash', {
								text: 'This account does not exist in our records anymore.',
								class: 'danger',
							});
							helpers.sendJSON(res, { redirect: '/login' });
						}
					});
				} else {
					req.flash('loginFlash', {
						text: 'Invalid token. Please request to reset your ' +
							'password again.',
						class: 'danger',
					});
					helpers.sendJSON(res, { redirect: '/login' });
				}
			}
		});
	} else {
		req.flash('validResetFlash', {
			text: 'The passwords you entered are not the same.',
			class: 'danger',
		});
		helpers.sendJSON(res, { redirect: '/reset/' + token });
	}
};

router.postLogout = function (req, res) {
	req.logout();
	req.flash('loginFlash', {
		text: 'You have been logged out.',
		class: 'success',
	});
	helpers.sendJSON(res, { redirect: '/login' });
};

router.postAccess = function (req, res) {
	var userId = req.body.userId;
	var access = req.body.access;
	if (access >= Access.VOLUNTEER &&
		access <= Access.ADMIN &&
		(req.user.access == Access.ADMIN ||
		access < req.user.access)) {
		User.update({
			_id: userId,
		}, {
			$set: {
				access: access,
			},
		}, function (err) {
			if (err) {
				console.error(err);
			} else {
				req.flash('usersFlash', {
					text: 'The user\'s access rights have been updated.',
					class: 'success',
				});
			}

			helpers.sendJSON(res, { redirect: '/users' });
		});
	} else {
		helpers.sendJSON(res, { redirect: '/users' });
	}
};

function validateUsers(users, req, options, cb) {
	var isNewUser = ifDefined(options.newUser, true);
	User.find({}, 'email', function (err, results) {
		if (err) {
			cb(err);
		} else {
			var emails = results.map(function (elem) {return elem.email;});

			var validatedUsers = [];
			for (var i = 0; i < users.length; i++) {
				var user = users[i];
				var isNameValid = user.name !== undefined &&
					user.name.value !== undefined &&
					user.name.value.length > 0;
				var isEmailValid = user.email !== undefined &&
					user.email.value !== undefined &&
					user.email.value.length > 0 &&
					validator.validate(user.email.value) &&
					(!isNewUser || emails.indexOf(user.email.value) == -1);
				var countryCodeValue = (user.countryCode !== undefined &&
					user.countryCode.value !== undefined ? user.countryCode.value :
					req.user.countryCode);
				var isCountryValid = countryCodeValue !== undefined &&
					countryCodeValue.length === 2 &&
					countries.countries[countryCodeValue] !== undefined;

				var accessValue;
				if (user.access !== undefined && user.access.value !== undefined && user.access.value !== '') {
					var accessValueStr = user.access.value.toString().toLowerCase();
					if (accessValueStr == 'admin' ||
						accessValueStr == 'administrator' ||
						accessValueStr == 'administrators' ||
						accessValueStr == 'a' ||
						accessValueStr == Access.ADMIN) {
						accessValue = Access.ADMIN;
					} else if (accessValueStr == 'staff' ||
						accessValueStr == 's' ||
						accessValueStr == Access.STAFF) {
						accessValue = Access.STAFF;
					} else if (accessValueStr == 'volunteer' ||
						accessValueStr == 'v' ||
						accessValueStr == 'volunteers' ||
						accessValueStr == Access.VOLUNTEER) {
						accessValue = Access.VOLUNTEER;
					} else {
						accessValue = user.access.value;
					}
				} else {
					accessValue = Access.VOLUNTEER;
				}

				var isAccessValid = (accessValue >= Access.VOLUNTEER &&
					accessValue <= Access.ADMIN && (accessValue < req.user.access ||
					req.user.access === Access.ADMIN));
				var phonesValue = user.phones === undefined && isNewUser ?
					[] : user.phones.value;
				var arePhonesValid = phonesValue !== undefined &&
					phonesValue instanceof Array;

				// Because lib-phonenumber throws errors instead of following
				// JS conventions
				var index = 0;
				while (arePhonesValid && index < phonesValue.length) {
					try {
						var phoneString = phonesValue[index];
						var phoneNumber = phoneUtil.parseAndKeepRawInput(phoneString);
						arePhonesValid = phoneUtil.isPossibleNumber(phoneNumber);
					} catch (e) {
						arePhonesValid = false;
					}

					index++;
				}

				validatedUsers.push({
					name: {
						value: user.name === undefined ? '' : user.name.value,
						valid: isNameValid,
					},
					email: {
						value: user.email === undefined ? '' : user.email.value,
						valid: isEmailValid,
					},
					country: {
						value: (isCountryValid ? countries.countries[countryCodeValue] : ''),
						valid: isCountryValid,
					},
					countryCode: {
						value: countryCodeValue,
						valid: isCountryValid,
					},
					access: {
						value: accessValue,
						valid: isAccessValid,
					},
					phones: {
						value: phonesValue,
						valid: arePhonesValid,
					},
					valid: isNameValid && isEmailValid && isCountryValid &&
						isAccessValid && arePhonesValid,
				});
				if (isNewUser && user.email !== undefined) {
					emails.push(user.email.value);
				}
			}

			cb(null, validatedUsers);
		}
	});
}

function capitalizeFirstLetter(string) {
	return string.charAt(0).toUpperCase() + string.slice(1);
}

router.postUpdatedUser = function (req, res) {
	var userId = req.params.userId;

	// Verify that this user can edit this user
	if (userId != req.user._id && req.user.access !== Access.ADMIN) {
		return helpers.sendUnauthorized(res);
	}

	// Validate the new user object
	var updatedUser = {
		name: {
			value: ifDefined(req.body.name, req.paramUser.name),
		},
		email: {
			value: ifDefined(req.body.email, req.paramUser.email),
		},
		countryCode: {
			value: ifDefined(req.body.countryCode, req.paramUser.countryCode),
		},
		access: {
			value: ifDefined(req.body.access, req.paramUser.access),
		},
		phones: {
			value: req.body.phones === 'empty' ? [] :
				ifDefined(req.body.phones, req.paramUser.phones),
		},
	};

	validateUsers([updatedUser], req, { newUser: false }, function (err, users) {
		if (err) { throw err; }

		var validatedUser = users[0];
		var updatesToMake = {
			name: (validatedUser.name.valid ?
				validatedUser.name.value : req.paramUser.name),
			email: (validatedUser.email.valid ?
				validatedUser.email.value : req.paramUser.email),
			countryCode: (validatedUser.countryCode.valid ?
				validatedUser.countryCode.value : req.paramUser.countryCode),
			access: (validatedUser.access.valid ?
				validatedUser.access.value : req.paramUser.access),
			phones: (validatedUser.phones.valid ?
				validatedUser.phones.value : req.paramUser.phones),
		};

		User.findByIdAndUpdate(userId, updatesToMake, function (err, old) {
			if (err) {
				req.flash('profileFlash', {
					text: 'An occurred while attempting to update ' +
						(req.user._id == userId ? 'your' :
							old.name + '\'s') + ' profile.',
				});
				console.error(err);
			} else {
				req.flash('profileFlash', {
					text: (req.user._id == userId ?
						'Your profile has been updated.' :
						updatesToMake.name + '\'s profile has been updated.'),
					class: 'success',
				});
			}

			helpers.sendJSON(res, { redirect: '/profile/' + userId });
		});
	});
};

router.postUsers = function (req, res) {
	// Now that we have converted the CSV to JSON, we need to validate it
	validateUsers(req.body, req, {}, function (err, validatedUsers) {
		if (err) { throw err; }

		var allValid = validatedUsers.every(function (user) {
			return user && user.valid;
		});

		if (allValid) {
			// Form the Mongo User objects
			var users = validatedUsers.map(function (user) {
				return new User({
					name: user.name.value,
					email: user.email.value,
					phones: [],
					hash: '',
					access: user.access.value,
					countryCode: user.countryCode.value,
					pending: true,
				});
			});

			User.insertMany(users, function (err, insertedUsers) {
				if (err) {
					req.flash('addUsersFlash', {
						text: 'An error occurred while attempting to send out registration emails.',
						class: 'danger',
					});
					return helpers.sendJSON(res, { redirect: '/users/add' });
				}

				var tokens = insertedUsers.map(function (user) {
					// Form the Mongo Token objects
					return new Token({
						token: randtoken.generate(64),
						user: user._id,
						tokenType: tokenTypes.REGISTER,
					});
				});

				// Add a token for each new user
				Token.insertMany(tokens, function (err) {
					if (err) {
						req.flash('addUsersFlash', {
							text: 'Some of the uploaded users are invalid. ' +
								'Please fix the issues in the table below before creating any users.',
							class: 'danger',
						});
						return helpers.sendJSON(res, { redirect: '/users/add' });
					}

					var subject = 'Peace Corps BonVoyage Registration';

					// Send template emails in parallel
					process.nextTick(function () {
						async.forEachOfLimit(users, 5, function (user, i, callback) {
							var token = tokens[i];
							var sendTo = [user.email.toLowerCase()];
							var map = {
								name: capitalizeFirstLetter(user.name.toLowerCase().split(' ')[0]),
								button: process.env.BONVOYAGE_DOMAIN + '/register/' + token.token,
							};
							helpers.sendTemplateEmail(sendTo, subject, 'register', map, callback);
						}, function (err) {

							if (err) {
								console.error('An error occurred while attempting to send out registration emails.');
							}
						});
					});

					req.flash('usersFlash', {
						text: 'Registration invitation(s) have been sent to ' + validatedUsers.length + ' user(s).',
						class: 'success',
					});
					helpers.sendJSON(res, { redirect: '/users' });
				});
			});
		} else {
			req.flash('addUsersFlash', {
				text: 'Some of the uploaded users are invalid. ' +
					'Please fix the issues in the table below before creating any users.',
				class: 'danger',
			});

			helpers.sendJSON(res, { redirect: '/users/add' });
		}
	});
};

router.validateUsers = function (req, res) {
	var file = req.file;
	if (file !== undefined && file.path) {
		var converter = new Converter({
			noheader: true,
		});
		converter.fromFile(file.path, function (err, json) {
			if (err) {
				throw err;
			} else {
				var formattedJSON = [];
				for (var i = 0; i < json.length; i++) {
					if (json[i].field1 || json[i].field2 || json[i].field3 || json[i].field4) {
						formattedJSON.push({
							name: { value: json[i].field1 },
							email: { value: json[i].field2 },
							countryCode: { value: json[i].field3 },
							access: { value: json[i].field4 },
						});
					}
				}

				// Now that we have converted the CSV to JSON, we need to validate it
				validateUsers(formattedJSON, req, {}, function (err, newUsers) {
					if (err) { throw err; }

					helpers.sendJSON(res, newUsers);
				});
			}
		});
	} else {
		helpers.sendJSON(res, null);
	}
};

/*
 * DELETE Requests
 */
router.deleteUser = function (req, res) {
	var userId = req.params.userId;
	if (userId == req.user._id || req.user.access == Access.ADMIN) {
		Request.find({ volunteer: userId }).remove(function (err) {
			if (err) {
				console.error(err);
				req.flash('usersFlash', {
					text: 'An error has occurred while attempting to delete the user.',
					class: 'danger',
				});
				helpers.sendJSON(res, { redirect: '/users' });
			} else {
				User.find({ _id: userId }).remove(function (err) {
					if (err) {
						console.error(err);
						req.flash('usersFlash', {
							text: 'An error has occurred while attempting to delete the user.',
							class: 'danger',
						});
					} else {
						req.flash('usersFlash', {
							text: 'The user has been deleted.',
							class: 'success',
						});
					}

					helpers.sendJSON(res, { redirect: '/users' });
				});
			}
		});
	} else {
		helpers.sendUnauthorized(res);
	}
};

router.deleteRequest = function (req, res) {
	var id = req.params.requestId;

	Request.findOne({ _id: id }, function (err, request) {
		if (err) {
			return helpers.sendError(res, err);
		}

		if (req.user.access == Access.ADMIN ||
				request.volunteer.equals(req.user._id)) {
			request.remove(function (err) {
				if (err) {
					return helpers.sendError(res, err);
				}

				req.flash('dashboardFlash', {
					text: 'The request has been successfully deleted.',
					class: 'success',
				});
				helpers.sendJSON(res, { redirect: '/dashboard' });
			});
		} else {
			return helpers.sendUnauthorized(res);
		}
	});
};

module.exports = router;
