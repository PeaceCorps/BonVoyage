var express = require('express');
var router = express.Router();
var User = require("../models/user");
var Request = require("../models/request");
var Token = require("../models/token");
var Access = require("../config/access");
var fs = require('fs');
var moment = require('moment');
var randtoken = require('rand-token');
var countries_dictionary = JSON.parse(fs.readFileSync("public/data/countryList.json", 'utf8'));
var helpers = require('./helpers');
var DateOnly = require('dateonly');

/*
 * Handle Parameters
 */
router.handleRequestId = function(req, res, next, request_id) {
	// Look up request_id to determine if it is pending or not
	Request.findOne({ _id: request_id }, 'status', function(err, request) {
		if (err) next(err);
		helpers.getRequests(req, res, request.status.is_pending, function(err, requests) {
			if (err) next(err);
			else {
				// Lookup the id in this list of requests
				for(var i = 0; i < requests.length; i++) {
					if(requests[i]._id == request_id) {
						req.request = requests[i];
						req.next_request_id = (i < requests.length - 1 ? requests[i+1]._id : undefined);
						req.prev_request_id = (i > 0 ? requests[i-1]._id : undefined);
						next();
					}
				}
				if (req.request == undefined)
					next(new Error('Request not found.'));
			}
		});
	});
}

/*
 * GET Requests
 */

router.getRequests = function(req, res) {
	helpers.getRequests(req, res, undefined, function(err, requests) {
		if(err) console.error(err);
		res.send(requests);
	});
};

router.getPendingRequests = function(req, res) {
	helpers.getRequests(req, res, true, function(err, requests) {
		if(err) console.error(err);
		res.send(requests);
	});
};

router.getPastRequests = function(req, res) {
	helpers.getRequests(req, res, false, function(err, requests) {
		if(err) console.error(err);
		res.send(requests);
	});
};

router.getUsers = function(req, res) {
	var rawMaxAccess = req.query.maxAccess;
	var maxAccess = Access[rawMaxAccess];
	helpers.getUsers({
		maxAccess: maxAccess,
	}, function(err, users) {
		if(err) console.error(err);
		res.send(users);
	});
}

/*
 * POST Requests
 */

router.postRequests = function(req, res) {
	var email = req.user.email;
	// Supervisors will select the user to submit the request for on the submission form
	if (req.user.access >= Access.SUPERVISOR) {
		email = req.body.email;
		if (email == undefined) {
			req.session.submission = req.body;
			req.flash('submissionFlash', { text: 'You must select a requestee to submit this request for.', class: 'danger' });
			res.end(JSON.stringify({redirect: '/dashboard/submit'}));
			return;
		}
	}
	// Verify that the user exists
	helpers.getUsers({
		user: {
			email: email
		}
	}, function(err, users) {
		if(users.length > 0) {
			var legs = [];
			for (var i = 0; i < req.body.legs.length; i++) {
				leg = req.body.legs[i];
				var start = new DateOnly(leg.start_date);
				var end = new DateOnly(leg.end_date);
				console.log(start);
				console.log(end);

				if (start > end) {
					req.session.submission = req.body;
					req.flash('submissionFlash', { text: 'The start date you entered for leg #' + (i+1) + ' comes after the end date.', class: 'danger' });
					res.end(JSON.stringify({redirect: '/dashboard/submit'}));
					return;
				} else if (Object.keys(countries_dictionary).indexOf(leg.country) == -1) {
					req.session.submission = req.body;
					req.flash('submissionFlash', { text: 'The country that you have selected for leg #' + (i+1) + ' is not a valid country.', class: 'danger' });
					res.end(JSON.stringify({redirect: '/dashboard/submit'}));
					return;
				}

				legs.push({
					start_date: start,
					end_date: end,
					country: countries_dictionary[leg.country],
					country_code: leg.country,
					hotel: leg.hotel,
					contact: leg.contact,
					companions: leg.companions,
					description: leg.description
				});
			}

			if (legs.length > 0) {
				var newRequest = new Request({
					email: email,
					status: {
						is_pending: true,
						is_approved: false
					},
					legs: legs
				});

				newRequest.save(function(err, obj) {
					if (err) {
						req.session.submission = req.body;
						req.flash('submissionFlash', { text: 'An error has occurred while trying to save this request. Please try again.', class: 'danger' });
						res.end(JSON.stringify({redirect: '/dashboard/submit'}));
					} else {
						req.flash('dashboardFlash', { 
							text: 'Request successfully saved.', 
							class: 'success',
							link: {
								url: '/requests/' + obj._id,
								text: 'View Request.'
							} 
						});
						res.end(JSON.stringify({redirect: '/dashboard'}));
					}
				});
			} else {
				req.session.submission = req.body;
				req.flash('submissionFlash', { text: 'An error has occurred while trying to save this request. Please try again.', class: 'danger' });
				res.end(JSON.stringify({redirect: '/dashboard/submit'}));
			}
		} else {
			req.session.submission = req.body;
			req.flash('submissionFlash', { text: 'The user that you selected could not be found.', class: 'danger' });
			res.end(JSON.stringify({redirect: '/dashboard/submit'}));
			return;
		}
	});
}

router.postApprove = function(req, res) {
	var id = req.params.request_id;
	Request.findByIdAndUpdate(id, {$set:{"status.is_pending":false, "status.is_approved":true}}, function(err, doc) {
		if (err) return res.send(500, {error: err});

		var sendFrom = 'Peace Corps <team@projectdelta.io>';
		var sendTo = doc.email;
		var subject = 'Peace Corps BonVoyage Request Approved';
		var text = 'Hi ' + req.user.name + ',\n\n Your travel request has been approved. Please visit BonVoyage website to review your request.';

		// send email
		helpers.sendEmail(sendFrom, sendTo, subject, text, console.log("email sent!"));


		req.flash('dashboardFlash', { 
			text: 'The request has been successfully approved.', 
			class: 'success',
			link: {
				url: '/requests/' + id,
				text: 'View Request.'
			}
		});
		res.end(JSON.stringify({redirect: '/dashboard'}));
	});
}

router.postDeny = function(req, res) {
	var id = req.params.request_id;
	Request.findByIdAndUpdate(id, {$set:{"status.is_pending":false, "status.is_approved":false}}, function(err, doc) {
		if (err) return res.send(500, {error: err});

		var sendFrom = 'Peace Corps <team@projectdelta.io>';
		var sendTo = doc.email;
		var subject = 'Peace Corps BonVoyage Request Denied';
		var text = 'Hi ' + req.user.name + ',\n\n Your travel request has been denied. Please visit BonVoyage website to review your request.';

		// send email
		helpers.sendEmail(sendFrom, sendTo, subject, text, console.log("email sent!"));

		req.flash('dashboardFlash', { 
			text: 'The request has been successfully denied.', 
			class: 'success',
			link: {
				url: '/requests/' + id,
				text: 'View Request.'
			}
		});
		res.end(JSON.stringify({redirect: '/dashboard'}));
	});
}

router.postDelete = function(req, res) {
	var id = req.params.request_id;
	Request.findOneAndRemove({'_id':id, email: req.user.email}, function(err, doc) {
		if (err) return res.send(500, {error: err});
		req.flash('dashboardFlash', { 
			text: 'The request has been successfully deleted.', 
			class: 'success',
			link: {
				url: '/requests/' + id,
				text: 'View Request.'
			}
		});
		res.end(JSON.stringify({redirect: '/dashboard'}));
	});
}

router.postComments = function(req, res) {
	var id = req.params.request_id;
	Request.findByIdAndUpdate(id, {$push: {
		comments: {
			$each:[{
				name:req.user.name,
				email:req.user.email,
				content:req.param('content')
			}]
		}
	}}, function(err, doc) {
		if (err) return res.send(500, {error: err});
		req.flash('approvalFlash', { text: 'Your comment has been added.', class: 'success' });
		res.end(JSON.stringify({redirect: '/requests/' + id}));
	});
}

router.reset = function(req, res) {
	var email = req.body.email;

	// first check if email is registered
	User.findOne({ email: email }, function(err, user) {
		if (err) {
			req.flash('loginFlash', { text: 'The account you are looking for does not exist on our record.', class: 'danger'});
			res.end(JSON.stringify({redirect: '/login'}));
		} else {
			// TODO: existing token must be removed
			var token = randtoken.generate(64);

			Token.create({token: token, email: email}, function(err, doc) {
				if (err) {
					req.flash('loginFlash', { text: 'Failed to generate an email reset token.', class: 'danger'});
					res.end(JSON.stringify({redirect: '/login'}));
				}

				var sendFrom = 'Peace Corps <team@projectdelta.io>';
				var sendTo = email;
				var subject = 'Peace Corps BonVoyage Password Reset Request';
				var text = 'Hi ' + user.name + ',\n\nWe have received a request to reset your password. Please visit the following URL to reset your password.\n\nhttp://localhost:3000/reset/' + token;

				// send email
				helpers.sendEmail(sendFrom, sendTo, subject, text, console.log("email sent!"));
			});
		}
			
	});

	req.flash('loginFlash', { text: 'Instructions to reset your password have been sent to your email address.', class: 'success'});
	res.end(JSON.stringify({redirect: '/login'}));

}

router.resetValidator = function(req, res) {
	var token = req.params.token;
	var newPassword = req.body.newPassword;
	var confirmPassword = req.body.confirmPassword;

	if (newPassword == confirmPassword) {
		// validate token
		// modify the password
		Token.findOneAndRemove({ token: token }, function(err, validToken) {
			if (err) {
				req.flash('loginFlash', { text: 'Invalid token. Please request to reset your password again.', class: 'danger'});
				res.end(JSON.stringify({redirect: '/login'}));
			} else {
				// token has been found
				if (validToken) {
					var email = validToken.email;

					User.findOne({ email: email }, function(err, account) {
						if (err) {
							req.flash('loginFlash', { text: 'This account does not exist in our records anymore.', class: 'danger'});
							res.end(JSON.stringify({redirect: '/login'}));
						} else {
							account.hash = newPassword;

							account.save(function(err) {
								if (err) {
									// couldn't save the user
									req.flash('loginFlash', { text: 'There has been an error resetting your password. Please retry.', class: 'danger'});
									res.end(JSON.stringify({redirect: '/login'}));
								}
								req.flash('loginFlash', { text: 'Your password has been successfully updated.', class: 'success'});
								res.end(JSON.stringify({redirect: '/login'}));
							});
						}
					});
				} else {
					req.flash('loginFlash', { text: 'Invalid token. Please request to reset your password again.', class: 'danger'});
					res.end(JSON.stringify({redirect: '/login'}));
				}
			}
		});
	} else {
		req.flash('loginFlash', { text: 'New Password is different from Confirm Password. Please retry.', class: 'danger'});
		res.end(JSON.stringify({redirect: '/login'}));
	}
}

router.logout = function(req, res) {
	req.logout();
	req.flash('loginFlash', { text: 'You have been logged out.', class: 'success'});
	res.end(JSON.stringify({redirect: '/login'}));
}

router.modifyAccess = function(req, res) {
	email = req.body.email;
	access = req.body.access;
	if (access >= Access.VOLUNTEER && access <= Access.ADMIN && (req.user.access == Access.ADMIN || access < req.user.access)) {
		User.update({ email: email }, { $set: { access: access } }, function(err, numAffected) {
			if (err) console.error(err);
			else req.flash('usersFlash', { text: 'The user\'s access rights have been updated.' , class: 'success'});
			res.end(JSON.stringify({redirect: '/users'}));
		});
	} else {
		res.end(JSON.stringify({redirect: '/users'}));
	}
}

/*
 * DELETE Requests
 */

router.deleteUser = function(req, res) {
	email = req.body.email;
	console.log(email);
	Request.find({ email: email }).remove(function(err, numAffected) {
		if(err) {
			console.error(err);
			req.flash('usersFlash', { text: 'An error has occurred while attempting to delete the user.' , class: 'danger'});
			res.end(JSON.stringify({redirect: '/users'}));
		} else {
			User.find({ email: email }).remove(function(err, numAffected) {
				if (err) {
					console.error(err);
					req.flash('usersFlash', { text: 'An error has occurred while attempting to delete the user.' , class: 'danger'});
				} else {
					req.flash('usersFlash', { text: 'The user has been deleted.' , class: 'success'});
				}
				res.end(JSON.stringify({redirect: '/users'}));
			});
		}
	});
}

module.exports = router;

