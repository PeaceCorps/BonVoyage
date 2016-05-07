/* jshint node: true */
'use strict';

var LocalStrategy = require('passport-local').Strategy;
var helpers = require(__dirname + '/../routes/helpers');

// load user model
var User = require(__dirname + '/../models/user');
var Token = require(__dirname + '/../models/token');

var Access = require(__dirname + '/access');

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
		usernameField: 'email',
		passwordField: 'password',

		// allows us to pass back the entire request to the callback
		passReqToCallback: true,
	},
	function (req, email, password, done) {
		email = email.toLowerCase();

		console.log(req.body.token);

		// asynchronous
		// User.findOne wont fire unless data is sent back
		process.nextTick(function () {
			Token.findOne({ token: req.body.token, email: email, tokenType: true },
				function (err, token) {
					if (err) {
						console.log(err);
						return done(err);
					}

					// invalid token
					if (token) {
						// find a user whose email is the same as the forms email
						// we are checking to see if the user trying to login already exists
						User.findOne({ email: email }, function (err, user) {
							// if there are any errors, return the error
							if (err) {
								console.log('Email already exists.');
								return done(err);
							}

							// check to see if theres already a user with that email
							if (user) {
								console.log('That email is already taken');
								req.session.submission = req.body;
								return done(null, false, req.flash('loginFlash',
										{
											text: 'That email is already taken.',
											class: 'danger',
										}));
							} else if (password != req.body.password2) {
								console.log('Those passwords do not match');
								req.session.submission = req.body;
								return done(null, false, req.flash('loginFlash',
										{
											text: 'Those passwords do not match.',
											class: 'danger',
										}));
							} else {
								// if there is no user with that email
								// create the user
								var newUser = new User();

								// set the user's local credentials
								newUser.email = token.email;

								// This password will be hashed, and in the process
								// overwrite the plain text password we just stored into newUser.hash
								newUser.hash = password;
								newUser.name = token.name;
								newUser.phones = [];
								newUser.access = Access.VOLUNTEER;
								newUser.countryCode = token.country;

								console.log('generating new user');

								// save the user
								newUser.save(function (err) {
									if (err) {
										return done(err);
									}

									var sendFrom = 'Peace Corps <team@projectdelta.io>';
									var sendTo = [email];
									var subject = 'Peace Corps BonVoyage Registration Confirmation';
									var map = {
										name: token.name.split(' ')[0],
										button: process.env.BONVOYAGE_DOMAIN,
									};

									// asynchronous
									process.nextTick(function () {
										helpers.sendTemplateEmail(sendFrom, sendTo, subject,
										'welcome', map);
									});

									return done(null, newUser);
								});

								token.remove();
							}
						});
					} else {
						console.log('invalid token');
						return done(null, false, req.flash('loginFlash',
							{
								text: 'Registration Token is invalid.',
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
		// we are checking to see if the user trying to login already exists
		User.findOne({ email:  email }, function (err, user) {
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
