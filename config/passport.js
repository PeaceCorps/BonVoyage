/* jshint node: true */
'use strict';

var LocalStrategy = require('passport-local').Strategy;
var helpers = require(__dirname + '/../routes/helpers');

// load user model
var User = require(__dirname + '/../models/user');
var Token = require(__dirname + '/../models/token');

var tokenTypes = require(__dirname + '/token-types');

module.exports = function (passport) {

	// =========================================================================
	// passport session setup ==================================================
	// =========================================================================
	// required for persistent login sessions
	// passport needs ability to serialize and unserialize users out of session

	// used to serialize the user for the session
	passport.serializeUser(function (user, done) {
		done(null, user.id);
	});

	// used to deserialize the user
	passport.deserializeUser(function (id, done) {
		User.findById(id).lean().exec(function (err, user) {
			done(err, user);
		});
	});

	// =========================================================================
	// LOCAL SIGNUP ============================================================
	// =========================================================================
	// we are using named strategies since we have one for login and one for signup

	passport.use('local-signup', new LocalStrategy({
		// by default, local strategy uses username and password,
		// we will override with email
		usernameField: 'password',
		passwordField: 'password2',

		// allows us to pass back the entire request to the callback
		passReqToCallback: true,
	}, function (req, password, password2, done) {
		var tokenStr = req.body.token;

		// asynchronous
		// User.findOne wont fire unless data is sent back
		process.nextTick(function () {
			Token.findOneAndRemove({ token: tokenStr, tokenType: tokenTypes.REGISTER })
				.populate({
					path: 'user',
				})
				.exec(function (err, token) {
					// check for an invalid token
					if (!err && token) {
						if (password != password2) {
							console.log('Passwords do not match');
							req.session.submission = req.body;
							return done(null, false, req.flash('loginFlash',
									{
										text: 'Those passwords do not match.',
										class: 'danger',
									}));
						} else {
							// save the user's new password
							User.findOneAndUpdate({ _id: token.user._id }, { hash: password, pending: false },
								function (err, updatedUser) {
								if (err) {
									console.log('failed to find user');
									return done(null, false, req.flash('loginFlash', {
										text: 'Registration token is invalid.',
										class: 'danger',
									}));
								}

								var sendTo = [token.user.email];
								var subject = 'Peace Corps BonVoyage Registration Confirmation';
								var map = {
									name: token.user.name.split(' ')[0],
									button: process.env.BONVOYAGE_DOMAIN,
								};

								// send the email async
								process.nextTick(function () {
									helpers.sendTemplateEmail(sendTo, subject, 'welcome', map);
								});

								done(null, updatedUser);
							});
						}
					} else {
						console.log('invalid token');
						if (err) {
							console.error(err);
						}

						return done(null, false, req.flash('loginFlash',
							{
								text: 'Registration token is invalid.',
								class: 'danger',
							}));
					}
				});
		});
	}));

	// =========================================================================
	// LOCAL LOGIN  ============================================================
	// =========================================================================
	// we are using named strategies since we have one for login and one for signup
	passport.use('local-login', new LocalStrategy({
		// by default, local strategy uses username and password,
		// we will override with email
		usernameField: 'email',
		passwordField: 'password',

		// allows us to pass back the entire request to the callback
		passReqToCallback: true,
	}, function (req, email, password, done) {
		// callback with email and password from our form
		email = email.toLowerCase();

		// find a user whose email is the same as the forms email
		// and who has authenticated their email (not pending)
		// we are checking to see if the user trying to login already exists
		User.findOne({ email: email, pending: false }, function (err, user) {
			// if there are any errors, return the error before anything else
			if (err) {
				return done(err);
			}

			// if no user is found, return the message
			if (!user) {
				// req.flash is the way to set flashdata using connect-flash
				req.session.submission = req.body;
				return done(null, false, req.flash('loginFlash', {
					text: 'That email/password combination is invalid.',
					class: 'danger',
				}));
			}

			// if the user is found but the password is wrong
			user.comparePassword(password, function (err, valid) {
				// check if
				if (err) {
					console.log(err);
				}

				if (!valid) {
					req.session.submission = req.body;
					return done(null, false, req.flash('loginFlash', {
						text: 'That email/password combination is invalid.',
						class: 'danger',
					}));
				}

				return done(null, user);
			});

		});
	}));
};
