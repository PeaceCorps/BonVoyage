/* globals describe */
/* globals it */
/* globals before */
/* globals after */
/* jshint node: true */
'use strict';
require(__dirname + '/../setup');

var assert = require('chai').assert;
var mongoose = require('mongoose');
var request = require('supertest');
var async = require('async');

var Access = require(__dirname + '/../config/access');
var mongoConnection = require(__dirname + '/../config/mongoConnection');
var serverObjects = require(__dirname + '/../bin/www');
var countries = require(__dirname + '/../config/countries');

var app = serverObjects.app;
var server = serverObjects.server;
var users;
var requests;
var agents;

var buildUserBase = require(__dirname +
	'/../build_scripts/buildUserBase.js');
var buildRequestBase = require(__dirname +
	'/../build_scripts/buildRequestBase.js');
var clearDatabase = require(__dirname +
	'/../build_scripts/clearDatabase.js');

var endpoints = {
	VIEWS: [
		{ url: '/dashboard', access: Access.VOLUNTEER },
		{ url: '/dashboard/submit', access: Access.VOLUNTEER },
		{ url: '/requests/:requestId', access: Access.VOLUNTEER },
		{ url: '/requests/:requestId/edit', access: Access.VOLUNTEER },
		{ url: '/users', access: Access.STAFF },
		{ url: '/users/add', access: Access.ADMIN },
		{ url: '/profile', access: Access.VOLUNTEER },
		{ url: '/profile/:userId', access: Access.VOLUNTEER },
	],
	API: {
		GET: [
			{ url: '/api/requests', access: Access.VOLUNTEER },
			{ url: '/api/users', access: Access.VOLUNTEER },
			{ url: '/api/warnings', access: Access.VOLUNTEER },
		],
		POST: [
			{ url: '/api/requests/:requestId/approval', access: Access.STAFF },
			{ url: '/api/requests/:requestId/comments', access: Access.VOLUNTEER },
			{ url: '/api/users/:userId', access: Access.VOLUNTEER },
			{ url: '/api/requests', access: Access.VOLUNTEER },
			{ url: '/api/requests/:requestId', access: Access.VOLUNTEER },
			{ url: '/api/users', access: Access.ADMIN },
			{ url: '/api/users/validate', access: Access.ADMIN },
		],
		DELETE: [
			{ url: '/api/requests/:requestId', access: Access.VOLUNTEER },
			{ url: '/api/users/:userId', access: Access.VOLUNTEER },
		],
	},
	NO_LOGIN: [
		{ url: '/' },
		{ url: '/login' },
		{ url: '/register/:token' },
		{ url: '/reset' },
		{ url: '/reset/:token' },
	],
};

function closeDatabase(done) {
	mongoose.disconnect(done);
}

function setupDatabase(done) {
	mongoose.createConnection(mongoConnection.getConnectionString());
	mongoose.connection.on('error', function (err) {
		done(err);
	});

	mongoose.connection.on('connected', function () {
		clearDatabase(function (err) {
			if (err) {
				console.error(err);
				closeDatabase();
				done(err);
			} else {
				buildUserBase(function (err, users) {
					if (err) {
						console.error(err);
						closeDatabase();
						done(err);
					} else {
						buildRequestBase({
							random: false,
						}, function (err, requests) {
							if (err) {
								console.error(err);
								closeDatabase();
								done(err);
							} else {
								done(null, {
									users: users,
									requests: requests,
								});
							}
						});
					}
				});
			}
		});
	});
}

function userWithName(objects, name) {
	var foundUsers = objects.filter(function (object) {
		return object.name == name;
	});

	if (foundUsers.length !== 1) {
		throw Error('Did not find exactly one user with name: ' + name +
			' (found ' + foundUsers.length + ')');
	} else {
		return foundUsers[0];
	}
}

function requestsWithName(requests, name, field) {
	var user = userWithName(users, name);

	var foundRequests = requests.filter(function (request) {
		return user._id.equals(request[field]);
	});

	if (foundRequests.length === 0) {
		throw Error('Could not find any requests for: ' + name);
	}

	return foundRequests;
}

function initializeAgents(done) {
	agents = {
		volunteer: {
			request: request.agent(app),
			user: userWithName(users, 'Ishaan Parikh'),
		},
		staff: {
			request: request.agent(app),
			user: userWithName(users, 'Patrick Choquette'),
		},
		admin: {
			request: request.agent(app),
			user: userWithName(users, 'Colin King'),
		},
	};

	agents.volunteer.request
		.post('/api/login')
		.send({ email: 'ishaan@test.com', password: 'ishaan' })
		.end(function (err) {
			if (err) {
				return done(err);
			}

			agents.staff.request
				.post('/api/login')
				.send({ email: 'pchoquette@peacecorps.gov', password: 'patrick' })
				.end(function (err) {
					if (err) {
						return done(err);
					}

					agents.admin.request
						.post('/api/login')
						.send({ email: 'colink@umd.edu', password: 'colin' })
						.end(done);
				});
		});
}

before(function (done) {
	this.timeout(5000);
	setupDatabase(function (err, docs) {
		users = docs.users;
		requests = docs.requests;
		initializeAgents(done);
	});
});

describe('Endpoints redirect when not logged in', function () {
	endpoints.VIEWS.map(function (endpoint) {
		it('GET ' + endpoint.url + ' redirects to /login', function (done) {
			request(app)
				.get(endpoint.url)
				.expect(302)
				.expect(function (res) {
					assert.equal(res.header.location, '/login');
				})
				.end(done);
		});
	});

	endpoints.API.GET.map(function (endpoint) {
		it('GET ' + endpoint.url + ' returns 401', function (done) {
			request(app)
				.get(endpoint.url)
				.expect(401, done);
		});
	});

	endpoints.API.POST.map(function (endpoint) {
		it('POST ' + endpoint.url + ' returns 401', function (done) {
			request(app)
				.post(endpoint.url)
				.expect(401, done);
		});
	});

	endpoints.API.DELETE.map(function (endpoint) {
		it('DELETE ' + endpoint.url + ' returns 401', function (done) {
			request(app)
				.delete(endpoint.url)
				.expect(401, done);
		});
	});
});

describe('Other endpoints redirect when logged in', function () {
	var agent = request.agent(app);

	before(function (done) {
		agent
			.post('/api/login')
			.send({ email: 'colink@umd.edu', password: 'colin' })
			.end(done);
	});

	endpoints.NO_LOGIN.map(function (endpoint) {
		it(endpoint.url + ' redirects to /dashboard if logged in', function (done) {
			agent
				.get(endpoint.url)
				.expect(302)
				.expect(function (res) {
					assert.equal(res.header.location, '/dashboard');
				})
				.end(done);
		});
	});
});

describe('error page renders', function () {
	it('Redirects to the error page', function (done) {
		request(app)
			.get('/some/nonexistant/page')
			.expect(404)
			.expect(function (res) {
				assert(res.text.indexOf('errorContainer') > -1);
			})
			.end(done);
	});

	it('Redirects to the error page when logged in', function (done) {
		agents.volunteer.request
			.get('/some/nonexistant/page')
			.expect(404)
			.expect(function (res) {
				assert(res.text.indexOf('errorContainer') > -1);
			})
			.end(done);
	});
});

describe('needAccess properly limits access level', function () {
	var getCheckEndpointFunc = function (
		statusCodeExpected, failureStatusCodeExpected) {
		return function (endpoint) {
			if (endpoint.access !== undefined) {
				if (endpoint.access == Access.VOLUNTEER) {
					it('Volunteers can access GET ' + endpoint.url, function (done) {
						// Modify the endpoint, if necessary
						endpoint.url = endpoint.url.replace(':userId', agents.volunteer.user._id);
						endpoint.url = endpoint.url.replace(':requestId',
							requestsWithName(requests,
								agents.volunteer.user.name, 'volunteer')[0]._id);

						agents.volunteer.request.get(endpoint.url)
							.redirects(1)
							.expect(statusCodeExpected, done);
					});
				} else {
					it('Volunteers can not access GET ' + endpoint.url, function (done) {
						agents.volunteer.request.get(endpoint.url)
							.redirects(0)
							.expect(failureStatusCodeExpected, done);
					});
				}

				if (endpoint.access <= Access.STAFF) {
					it('Staff can access GET ' + endpoint.url, function (done) {
						agents.staff.request.get(endpoint.url)
							.redirects(1)
							.expect(statusCodeExpected, done);
					});
				} else {
					it('Staff can not access GET ' + endpoint.url, function (done) {
						agents.staff.request.get(endpoint.url)
							.redirects(0)
							.expect(failureStatusCodeExpected, done);
					});
				}

				if (endpoint.access <= Access.ADMIN) {
					it('Admins can access GET ' + endpoint.url, function (done) {
						agents.admin.request.get(endpoint.url)
							.redirects(1)
							.expect(statusCodeExpected, done);
					});
				} else {
					it('Admins can not access GET ' + endpoint.url, function (done) {
						agents.admin.request.get(endpoint.url)
							.redirects(0)
							.expect(failureStatusCodeExpected, done);
					});
				}
			}
		};
	};

	endpoints.VIEWS.map(getCheckEndpointFunc(200, 302));
	endpoints.API.GET.map(getCheckEndpointFunc(200, 401));
	it('endpoints.api.post meet access restrictions');
	it('endpoints.api.delete meet access restrictions');
});

describe('GET /api/requests', function () {
	it('returns a valid request object', function (done) {
		agents.volunteer.request
			.get('/api/requests')
			.expect(200)
			.end(function (err, res) {
				if (err) {
					return done(err);
				}

				var requestList = res.body;
				assert.isArray(requestList);
				assert(requestList.length === 1,
					'Only one request exists by Ishaan that should be returned');
				var testRequest = requestList[0];
				assert(testRequest.startDate === 20160403);
				assert(testRequest.endDate === 20160410);
				assert(testRequest.status.isPending === true);
				assert(testRequest.status.isApproved === false);
				assert.isString(testRequest.timestamp);
				assert.isArray(testRequest.legs);
				assert(testRequest.legs.length === 1);
				assert(testRequest.legs[0].startDate === 20160403);
				assert(testRequest.legs[0].endDate === 20160410);
				assert(testRequest.legs[0].city === 'Chicago');
				assert(testRequest.legs[0].country === 'United States');
				assert(testRequest.legs[0].countryCode === 'US');
				assert(testRequest.legs[0].hotel === 'Test Hotel');
				assert(testRequest.legs[0].contact === '+14437654321');
				assert(testRequest.legs[0].companions === 'Test Companion');
				assert(testRequest.legs[0].description === 'Test Description');
				assert.isArray(testRequest.comments);
				assert(testRequest.comments.length === 1);
				assert(testRequest.comments[0].name === 'Patrick Choquette');
				assert(testRequest.comments[0].user.name === 'Patrick Choquette');
				assert(testRequest.comments[0].content.length > 0);
				assert.isString(testRequest.comments[0]._id);
				assert.isString(testRequest.comments[0].timestamp);
				assert(testRequest.counterpartApproved === true);
				assert(testRequest.reviewer.name === 'Patrick Choquette');
				assert(testRequest.volunteer.name === 'Ishaan Parikh');
				assert.isString(testRequest._id);
				done();
			});
	});

	it('requests for staff are limited by country', function (done) {
		agents.staff.request
			.get('/api/requests')
			.expect(200)
			.end(function (err, res) {
				if (err) {
					return done(err);
				}

				var requestList = res.body;
				assert(requestList.filter(function (u) {
					return u.volunteer.countryCode !== 'US';
				}).length === 0);
				assert(requestList.length === 2);
				done();
			});
	});

	it('requests for admins are not limited by country', function (done) {
		agents.admin.request
			.get('/api/requests')
			.expect(200)
			.end(function (err, res) {
				if (err) {
					return done(err);
				}

				var requestList = res.body;
				assert(requestList.filter(function (u) {
					return u.volunteer.countryCode !== 'US';
				}).length === 1);
				assert(requestList.length === 3);
				done();
			});
	});
});

describe('GET /api/requests/:requestId', function () {
	it('returns a correctly formatted request', function (done) {
		var rs = requestsWithName(requests, 'Ishaan Parikh', 'volunteer');
		assert(rs.length > 0);
		var request = rs[0];
		agents.admin.request
			.get('/api/requests/' + request._id)
			.expect(200)
			.end(function (err, res) {
				if (err) {
					return done(err);
				}

				assert.isObject(res.body);
				assert(res.body.reviewer.name === 'Patrick Choquette');
				assert(res.body.volunteer.name === 'Ishaan Parikh');
				assert.equal(res.body._id, request._id);
				done();
			});
	});
});

describe('GET /api/users', function () {
	var verifyReturnedUserAccess = function (query, permittedAccess, country, done) {
		agents.admin.request
			.get(query)
			.expect(200)
			.end(function (err, res) {
				if (err) {
					return done(err);
				}

				var userList = res.body;

				if (permittedAccess.indexOf(Access.VOLUNTEER) !== -1) {
					assert(userList.filter(function (u) {
						return u.access === Access.VOLUNTEER;
					}).length > 0);
				} else {
					assert(userList.filter(function (u) {
						return u.access === Access.VOLUNTEER;
					}).length === 0);
				}

				if (permittedAccess.indexOf(Access.STAFF) !== -1) {
					assert(userList.filter(function (u) {
						return u.access === Access.STAFF;
					}).length > 0);
				} else {
					assert(userList.filter(function (u) {
						return u.access === Access.STAFF;
					}).length === 0);
				}

				if (permittedAccess.indexOf(Access.ADMIN) !== -1) {
					assert(userList.filter(function (u) {
						return u.access === Access.ADMIN;
					}).length > 0);
				} else {
					assert(userList.filter(function (u) {
						return u.access === Access.ADMIN;
					}).length === 0);
				}

				if (country !== undefined) {
					assert(userList.filter(function (u) {
						return u.countryCode === country;
					}).length === userList.length);
				}

				done();
			});
	};

	it('returns the correct user objects for admins', function (done) {
		agents.admin.request
			.get('/api/users')
			.expect(200)
			.end(function (err, res) {
				if (err) {
					return done(err);
				}

				var userList = res.body;
				assert.isArray(userList);
				assert(userList.length > 0);
				userList.map(function (testUser) {
					assert.isObject(testUser);
					assert.isString(testUser.name);
					assert.isString(testUser.email);
					assert.isString(testUser.countryCode);
					assert.isString(testUser.country);
					assert.isString(testUser._id);
					assert.isNumber(testUser.access);
					assert.isArray(testUser.phones);
				});

				assert(userList.filter(function (u) {
					return u.access === Access.VOLUNTEER;
				}).length > 0, 'At least one volunteer is returned');
				assert(userList.filter(function (u) {
					return u.access === Access.STAFF;
				}).length > 0, 'At least one staff is returned');
				assert(userList.filter(function (u) {
					return u.access === Access.ADMIN;
				}).length > 0, 'At least one admin is returned');
				done();
			});
	});

	it('returns the correct user objects for staff', function (done) {
		agents.staff.request
			.get('/api/users')
			.expect(200)
			.end(function (err, res) {
				if (err) {
					return done(err);
				}

				var userList = res.body;
				assert(userList.filter(function (u) {
					return u.access === Access.VOLUNTEER;
				}).length > 0, 'At least one volunteer is returned');
				assert(userList.filter(function (u) {
					return u.access === Access.STAFF;
				}).length > 0, 'At least one staff is returned');
				assert(userList.filter(function (u) {
					return u.access === Access.ADMIN;
				}).length > 0, 'At least one admin is returned');
				done();
			});
	});

	it('returns the correct user objects for volunteers', function (done) {
		agents.volunteer.request
			.get('/api/users')
			.expect(200)
			.end(function (err, res) {
				if (err) {
					return done(err);
				}

				var userList = res.body;
				assert(userList.filter(function (u) {
					return u.access === Access.VOLUNTEER;
				}).length > 0, 'At least one volunteer is returned');
				assert(userList.filter(function (u) {
					return u.access === Access.STAFF;
				}).length > 0, 'At least one staff is returned');
				assert(userList.filter(function (u) {
					return u.access === Access.ADMIN;
				}).length > 0, 'At least one admin is returned');

				assert(userList.filter(function (u) {
					return u.countryCode === agents.volunteer.user.countryCode;
				}).length === userList.length, 'All returned users are from the volunteer\'s country');

				done();
			});
	});

	it('minAccess filters to just admins', function (done) {
		verifyReturnedUserAccess('/api/users?minAccess=2',
			[Access.ADMIN], undefined, done);
	});

	it('minAccess filters to just admins and staff', function (done) {
		verifyReturnedUserAccess('/api/users?minAccess=1',
			[Access.STAFF, Access.ADMIN], undefined, done);
	});

	it('minAccess does not filter when zero', function (done) {
		verifyReturnedUserAccess('/api/users?minAccess=0',
			[Access.VOLUNTEER, Access.STAFF, Access.ADMIN], undefined, done);
	});

	it('minAccess does not filter when < zero', function (done) {
		verifyReturnedUserAccess('/api/users?minAccess=-1',
			[Access.VOLUNTEER, Access.STAFF, Access.ADMIN], undefined, done);
	});

	it('minAccess returns nothing when > admin', function (done) {
		verifyReturnedUserAccess('/api/users?minAccess=3',
			[], undefined, done);
	});

	it('maxAccess filters to just volunteers', function (done) {
		verifyReturnedUserAccess('/api/users?maxAccess=0',
			[Access.VOLUNTEER], undefined, done);
	});

	it('maxAccess filters to just volunteers and staff', function (done) {
		verifyReturnedUserAccess('/api/users?maxAccess=1',
			[Access.STAFF, Access.VOLUNTEER], undefined, done);
	});

	it('maxAccess does not filter when = admin', function (done) {
		verifyReturnedUserAccess('/api/users?maxAccess=2',
			[Access.VOLUNTEER, Access.STAFF, Access.ADMIN], undefined, done);
	});

	it('maxAccess does not filter when > admin', function (done) {
		verifyReturnedUserAccess('/api/users?maxAccess=3',
			[Access.VOLUNTEER, Access.STAFF, Access.ADMIN], undefined, done);
	});

	it('maxAccess returns nothing when < zero', function (done) {
		verifyReturnedUserAccess('/api/users?maxAccess=-1',
			[], undefined, done);
	});

	it('country returns all when invalid', function (done) {
		verifyReturnedUserAccess('/api/users?country=HelloWorld',
			[Access.VOLUNTEER, Access.STAFF, Access.ADMIN], undefined, done);
	});

	it('country returns properly when set to country code', function (done) {
		verifyReturnedUserAccess('/api/users?country=US',
			[Access.VOLUNTEER, Access.STAFF, Access.ADMIN], 'US', done);
	});

	it('country returns properly when set to country', function (done) {
		verifyReturnedUserAccess('/api/users?country=United%20States',
			[Access.VOLUNTEER, Access.STAFF, Access.ADMIN], 'US', done);
	});

	it('country and maxAccess returns properly when set to a country', function (done) {
		verifyReturnedUserAccess('/api/users?country=US&maxAccess=1',
			[Access.VOLUNTEER, Access.STAFF], 'US', done);
	});
});

describe('GET /api/warnings', function () {
	it('returns a full warning object', function (done) {
		agents.admin.request
			.get('/api/warnings')
			.expect(200)
			.end(function (err, res) {
				if (err) {
					return done(err);
				}

				var warningList = res.body;
				assert.isObject(warningList);
				assert(Object.keys(warningList).length > 0);
				Object.keys(warningList).map(function (cc) {
					assert(warningList[cc].length > 0);
					warningList[cc].map(function (testWarning) {
						assert.isObject(testWarning);
						assert.isString(testWarning._id);
						assert.isString(testWarning.countryCode);
						assert.isString(testWarning.type);
						assert.isString(testWarning.textOverview);

						if (testWarning.link) {
							assert.isString(testWarning.link);
						}

						if (testWarning.startDate) {
							assert.isNumber(testWarning.startDate);
						}

						if (testWarning.endDate) {
							assert.isNumber(testWarning.startDate);
						}

						assert.isString(testWarning.colorClass);
						assert.isString(testWarning.source);
						assert.isString(testWarning.batchUUID);
						assert.isString(testWarning.timestamp);
					});
				});

				done();
			});
	});

	it('returns valid country keys', function (done) {
		agents.admin.request
			.get('/api/warnings')
			.expect(200)
			.end(function (err, res) {
				if (err) {
					return done(err);
				}

				var warningList = res.body;
				Object.keys(warningList).map(function (cc) {
					assert(countries.codeList.indexOf(cc) !== -1,
						cc + ' is not a valid country code');
				});

				done();
			});
	});
});

describe('POST /api/requests/:requestId/approval', function () {
	it('marks request as approved', function (done) {
		async.eachSeries(requests, function (request, cb) {
			agents.admin.request
			.post('/api/requests/' + request._id + '/approval')
			.send({ approval: true, comment: '', reviewer: request.reviewer })
			.expect(200)
				.end(function (err) {
					if (err) {
						return cb(err);
					}

					agents.admin.request
						.get('/api/requests/' + request._id)
						.expect(200)
						.end(function (err, res) {
							if (err) {
								return cb(err);
							}

							assert(res.body.status.isApproved === true);
							assert(res.body.status.isPending === true);
							cb();
						});
				});
		}, done);
	});

	it('marks request as denied', function (done) {
		async.eachSeries(requests, function (request, cb) {
			agents.admin.request
				.post('/api/requests/' + request._id + '/approval')
				.send({ approval: false, comment: '', reviewer: request.reviewer })
				.expect(200)
				.end(function (err) {
					if (err) {
						return cb(err);
					}

					agents.admin.request
						.get('/api/requests/' + request._id)
						.expect(200)
						.end(function (err, res) {
							if (err) {
								return cb(err);
							}

							assert(res.body.status.isApproved === false);
							assert(res.body.status.isPending === true);

							cb();
						});
				});
		}, done);
	});
});

describe('POST /api/requests/:requestId/comments', function () {
	it('adds the full comment', function (done) {
		async.eachSeries(requests, function (request, cb) {
			var commentString = 'This is a test comment for request id: ' + request._id;
			agents.admin.request
				.post('/api/requests/' + request._id + '/comments')
				.send({ content: commentString })
				.end(function (err) {
					if (err) {
						return cb(err);
					}

					agents.admin.request
						.get('/api/requests/' + request._id)
						.end(function (err, res) {
							if (err) {
								return cb(err);
							}

							var returnedComment = res.body.comments[res.body.comments.length - 1];
							assert(returnedComment.content === commentString);
							assert(returnedComment.name === agents.admin.user.name);
							assert(returnedComment.content === commentString);
							assert.isString(returnedComment.timestamp);
							assert.isString(returnedComment._id);
							assert.isObject(returnedComment.user);

							cb();
						});
				});
		}, done);
	});
});

describe('POST /api/users/:userId', function () {
	var user;
	before(function () {
		user = userWithName(users, 'John Doe');
	});

	it('updates the user object', function (done) {
		agents.admin.request
			.post('/api/users/' + user._id)
			.send({
				name: 'Test User',
				email: 'tester@test.com',
				countryCode: 'US',
				access: Access.STAFF,
				phones: [
					'+14431234567',
					'+10987654321',
				],
			})
			.expect(200)
			.end(function (err) {
				if (err) {
					return done(err);
				}

				agents.admin.request
					.get('/api/users/' + user._id)
					.expect(200)
					.end(function (err, res) {
						if (err) {
							return done(err);
						}

						assert.equal(res.body.name, 'Test User');
						assert.equal(res.body.email, 'tester@test.com');
						assert.equal(res.body.countryCode, 'US');
						assert.equal(res.body.access, Access.STAFF);
						assert.deepEqual(res.body.phones, [
							'+14431234567',
							'+10987654321',
						]);
						assert.equal(res.body.country, 'United States');
						assert.isString(res.body._id);
						done();
					});
			});
	});

	it('doesn\'t allow volunteers to edit other profiles', function (done) {
		agents.volunteer.request
			.post('/api/users/' + user._id)
			.send({
				name: 'A New Name',
			})
			.expect(401)
			.end(function (err) {
				if (err) {
					return done(err);
				}

				agents.volunteer.request
					.get('/api/users/' + user._id)
					.expect(200)
					.end(function (err, res) {
						if (err) {
							return done(err);
						}

						// Assert that no changes occurred
						assert.equal(res.body.name, 'Test User');
						done();
					});
			});
	});

	it('doesn\'t allow staff to edit other profiles', function (done) {
		agents.staff.request
			.post('/api/users/' + user._id)
			.send({
				name: 'A New Name',
			})
			.expect(401)
			.end(function (err) {
				if (err) {
					return done(err);
				}

				agents.staff.request
					.get('/api/users/' + user._id)
					.expect(200)
					.end(function (err, res) {
						if (err) {
							return done(err);
						}

						// Assert that no changes occurred
						assert.equal(res.body.name, 'Test User');
						done();
					});
			});
	});

	it('doesn\'t accept an empty string name/email/phone', function (done) {
		agents.admin.request
			.post('/api/users/' + user._id)
			.send({
				name: '',
				email: '',
				phones: '', // Non-array value
			})
			.expect(200)
			.end(function (err) {
				if (err) {
					return done(err);
				}

				agents.admin.request
					.get('/api/users/' + user._id)
					.expect(200)
					.end(function (err, res) {
						if (err) {
							return done(err);
						}

						// Assert that no changes occurred
						assert.equal(res.body.name, 'Test User');
						assert.equal(res.body.email, 'tester@test.com');
						assert.deepEqual(res.body.phones, [
							'+14431234567',
							'+10987654321',
						]);
						done();
					});
			});
	});

	it('doesn\'t enable access vulnerability for volunteers', function (done) {
		agents.volunteer.request
			.post('/api/users/' + agents.volunteer.user._id)
			.send({
				access: Access.ADMIN,
			})
			.expect(200)
			.end(function (err) {
				if (err) {
					return done(err);
				}

				agents.volunteer.request
					.get('/api/users/' + agents.volunteer.user._id)
					.expect(200)
					.end(function (err, res) {
						if (err) {
							return done(err);
						}

						// Assert that no changes occurred
						assert.equal(res.body.access, Access.VOLUNTEER);
						done();
					});
			});
	});

	it('doesn\'t enable access vulnerability for staff', function (done) {
		agents.staff.request
			.post('/api/users/' + agents.staff.user._id)
			.send({
				access: Access.ADMIN,
			})
			.expect(200)
			.end(function (err) {
				if (err) {
					return done(err);
				}

				agents.staff.request
					.get('/api/users/' + agents.staff.user._id)
					.expect(200)
					.end(function (err, res) {
						if (err) {
							return done(err);
						}

						// Assert that no changes occurred
						assert.equal(res.body.access, Access.STAFF);
						done();
					});
			});
	});

	it('doesn\'t allow changes to _id', function (done) {
		agents.admin.request
			.post('/api/users/' + user._id)
			.send({
				_id: '571fdb846ffb798fa940a95d',
			})
			.expect(200)
			.end(function (err) {
				if (err) {
					return done(err);
				}

				agents.admin.request
					.get('/api/users/' + user._id)
					.expect(200)
					.end(function (err, res) {
						if (err) {
							return done(err);
						}

						// Assert that no changes occurred
						assert.equal(res.body._id, user._id);
						done();
					});
			});
	});

	it('doesn\'t accept invalid data', function (done) {
		agents.admin.request
			.post('/api/users/' + user._id)
			.send({
				countryCode: 'BLAH',
				email: 'not an email',
				access: 'I am not a number',
				phones: [
					'not a phone number',
				],
			})
			.expect(200)
			.end(function (err) {
				if (err) {
					return done(err);
				}

				agents.admin.request
					.get('/api/users/' + user._id)
					.expect(200)
					.end(function (err, res) {
						if (err) {
							return done(err);
						}

						// Assert that no changes occurred
						assert.equal(res.body.email, 'tester@test.com');
						assert.equal(res.body.countryCode, 'US');
						assert.equal(res.body.access, Access.STAFF);
						assert.deepEqual(res.body.phones, [
							'+14431234567',
							'+10987654321',
						]);
						assert.equal(res.body.country, 'United States');
						done();
					});
			});
	});
});

describe('POST /api/register', function () {
	// @SeanBae
});

describe('POST /api/login', function () {
	var agent;
	before(function () {
		agent = request(app);
	});

	var loginFailed = function (done) {
		return function (err, res) {
			if (err) {
				return done(err);
			}

			assert.equal(res.header.location, '/login');
			done();
		};
	};

	it('fails with invalid credentials', function (done) {
		agent
			.post('/api/login')
			.send({ email: 'colink@umd.edu', password: 'not the password' })
			.expect(302)
			.end(loginFailed(done));
	});

	it('fails with missing email and password', function (done) {
		agent
			.post('/api/login')
			.expect(302)
			.end(loginFailed(done));
	});

	it('fails with missing password', function (done) {
		agent
			.post('/api/login')
			.send({ email: 'colink@umd.edu' })
			.expect(302)
			.end(loginFailed(done));
	});

	it('fails with pending users', function (done) {
		agent
			.post('/api/login')
			.send({ email: 'jake@test.com', password: 'jake' })
			.expect(302)
			.end(loginFailed(done));
	});

	it('fails with missing email', function (done) {
		agent
			.post('/api/login')
			.send({ password: 'test' })
			.expect(302)
			.end(loginFailed(done));
	});
});

describe('POST /api/logout', function () {
	it('logs the user out', function (done) {
		agents.volunteer.request
			.post('/api/logout')
			.expect(200)
			.end(function (err) {
				if (err) {
					return done(err);
				}

				agents.volunteer.request
					.get('/dashboard')
					.expect(302)
					.end(function (err, res) {
						if (err) {
							return done(err);
						}

						assert.equal(res.header.location, '/login');
						done();
					});
			});
	});

	it('fails when the user is not logged in', function (done) {
		// Note: the volunteer is currently logged out
		agents.volunteer.request
			.post('/api/logout')
			.expect(401)
			.end(done);
	});

	after(function (done) {
		// Log the volunteer back in
		agents.volunteer.request
			.post('/api/login')
			.send({ email: 'ishaan@test.com', password: 'ishaan' })
			.end(done);
	});
});

describe('POST /api/reset', function () {
	// @SeanBae
});

describe('POST /api/reset/:token', function () {
	// @SeanBae
});

describe('POST /api/requests', function () {
	it('validates the request', function (done) {
		var volunteer = userWithName(users, 'John Doe');
		agents.admin.request
			.post('/api/requests')
			.send({
				volunteer: volunteer._id,
				reviewer: agents.admin.user._id,
				legs: [
					{
						startDate: 20160319,
						endDate: 20160310, // Invalid start/end dates
						city: 'Sunnyvale',
						country: 'US',
					},
				],
				counterpartApproved: true,
			})
			.expect(200, {
				redirect: '/dashboard/submit',
			})
			.end(function (err) {
				if (err) {
					return done(err);
				}

				agents.admin.request
					.get('/api/requests')
					.expect(200)
					.end(function (err, res) {
						if (err) {
							return done(err);
						}

						assert(res.body.filter(function (request) {
							return request.volunteer._id == volunteer._id &&
								request.reviewer._id == agents.admin.user._id;
						}).length === 0);
						done();
					});
			});
	});

	it('creates the new request with the correct data', function (done) {
		var volunteer = userWithName(users, 'John Doe');
		agents.admin.request
			.post('/api/requests')
			.send({
				volunteer: volunteer._id,
				reviewer: agents.admin.user._id,
				legs: [
					{
						startDate: 20160309,
						endDate: 20160310,
						city: 'Sunnyvale',
						country: 'US',
					},
				],
				counterpartApproved: true,
			})
			.expect(200, {
				redirect: '/dashboard',
			})
			.end(function (err) {
				if (err) {
					return done(err);
				}

				agents.admin.request
					.get('/api/requests')
					.expect(200)
					.end(function (err, res) {
						if (err) {
							return done(err);
						}

						assert(res.body.filter(function (request) {
							return request.volunteer._id == volunteer._id &&
								request.reviewer._id == agents.admin.user._id;
						}).length > 0);
						done();
					});
			});
	});
});

describe('POST /api/requests/:requestId', function () {

	it('validates the request', function (done) {
		var rs = requestsWithName(requests, 'Ishaan Parikh', 'volunteer');
		assert(rs.length > 0);
		var request = rs[0];
		agents.admin.request
			.post('/api/requests/' + request._id)
			.send({
				legs: [
					{
						startDate: 20160319,
						endDate: 20160310, // Invalid start/end dates
						city: 'Sunnyvale',
						country: 'US',
					},
				],
			})
			.expect(200, {
				redirect: '/requests/' + request._id + '/edit',
			})
			.end(function (err) {
				if (err) {
					return done(err);
				}

				agents.admin.request
					.get('/api/requests/' + request._id)
					.expect(200)
					.end(function (err, res) {
						if (err) {
							return done(err);
						}

						assert(res.body.legs.length > 0);
						assert(res.body.legs[0].startDate != 20160319);
						assert(res.body.legs[0].city != 'Sunnyvale');
						done();
					});
			});
	});

	it('updates the request with the correct data', function (done) {
		var rs = requestsWithName(requests, 'Ishaan Parikh', 'volunteer');
		assert(rs.length > 0);
		var request = rs[0];
		agents.admin.request
			.post('/api/requests/' + request._id)
			.send({
				volunteer: userWithName(users, 'Ishaan Parikh'),
				reviewer: agents.admin.user._id,
				legs: [
					{
						startDate: 20160309,
						endDate: 20160310,
						city: 'Washington',
						country: 'US',
						addedLegCount: 1,
					},
				],
				counterpartApproved: true,
			})
			.expect(200, {
				redirect: '/requests/' + request._id,
			})
			.end(function (err) {
				if (err) {
					return done(err);
				}

				agents.admin.request
					.get('/api/requests/' + request._id)
					.expect(200)
					.end(function (err, res) {
						if (err) {
							return done(err);
						}

						assert(res.body.legs.length === 1);
						assert(res.body.legs[0].startDate == 20160309);
						assert(res.body.legs[0].city == 'Washington');
						assert(res.body.comments[2].name == 'Administrator');
						done();
					});
			});
	});
});

describe('POST /api/users', function () {
	// Formatted valid/value JSON
	it('validates the supplied users', function (done) {
		agents.admin.request
			.post('/api/users')
			.send([
				{
					// Missing email
					name: { value: 'Test Account' },
				},
			])
			.expect(200, {
				redirect: '/users/add',
			})
			.end(done);
	});

	it('inserts the new users into the database as pending', function (done) {
		agents.admin.request
			.post('/api/users')
			.send([
				{
					name: { value: 'Test Account' },
					email: { value: 'tester2@test.com' },
					access: { value: '0' },
					countryCode: { value: 'US' },
				},
			])
			.expect(200)
			.end(function (err) {
				if (err) {
					done(err);
				}

				agents.admin.request
					.get('/api/users')
					.expect(200)
					.end(function (err, res) {
						if (err) {
							done(err);
						}

						var testUser = res.body.filter(function (u) {
							return u.name === 'Test Account';
						})[0];

						assert(testUser.pending === true);
						done();
					});
			});
	});
});

describe('POST /api/users/validate', function () {
	it('returns the validated users', function (done) {
		agents.admin.request
			.post('/api/users/validate')
			.attach('users', __dirname + '/user_tests/test1.csv')
			.expect(200)
			.end(function (err, res) {
				if (err) {
					return done(err);
				}

				assert.isArray(res.body);
				assert(res.body.length == 3);
				res.body.forEach(function (user) {
					assert.isObject(user);
					assert.isObject(user.name);
					assert.isString(user.name.value);
					assert(user.name.valid === true);
					assert.isObject(user.email);
					assert.isString(user.email.value);
					assert(user.email.valid === true);
					assert.isObject(user.countryCode);
					assert.isString(user.countryCode.value);
					assert(user.countryCode.valid === true);
					assert.isObject(user.country);
					assert.isString(user.country.value);
					assert(user.country.valid === true);
					assert.isObject(user.access);
					assert.isNumber(user.access.value);
					assert(user.access.valid === true);
					assert.isObject(user.phones);
					assert(user.valid === true);
				});

				done();
			});
	});

	it('invalidates incorrect data', function (done) {
		agents.admin.request
			.post('/api/users/validate')
			.attach('users', __dirname + '/user_tests/test2.csv')
			.expect(200)
			.end(function (err, res) {
				if (err) {
					return done(err);
				}

				assert.isArray(res.body);
				assert(res.body.length == 7);

				// ,noname@test.com,US
				assert.isObject(res.body[0]);
				assert.isObject(res.body[0].name);
				assert(res.body[0].name.value === '');
				assert(res.body[0].name.valid === false);
				assert(res.body[0].email.value === 'noname@test.com');
				assert(res.body[0].email.valid === true);
				assert(res.body[0].countryCode.value === 'US');
				assert(res.body[0].countryCode.valid === true);
				assert(res.body[0].country.value === 'United States');
				assert(res.body[0].country.valid === true);
				assert(res.body[0].valid === false);

				// No Email,,US
				assert.isObject(res.body[1]);
				assert.isObject(res.body[1].name);
				assert(res.body[1].name.value === 'No Email');
				assert(res.body[1].name.valid === true);
				assert(res.body[1].email.value === '');
				assert(res.body[1].email.valid === false);
				assert(res.body[1].countryCode.value === 'US');
				assert(res.body[1].countryCode.valid === true);
				assert(res.body[1].country.value === 'United States');
				assert(res.body[1].country.valid === true);
				assert(res.body[1].valid === false);

				// No Country,country@country.com,
				assert.isObject(res.body[2]);
				assert.isObject(res.body[2].name);
				assert(res.body[2].name.value === 'No Country');
				assert(res.body[2].name.valid === true);
				assert(res.body[2].email.value === 'country@country.com');
				assert(res.body[2].email.valid === true);
				assert(res.body[2].countryCode.value === 'US'); // From logged in user
				assert(res.body[2].countryCode.valid === true);
				assert(res.body[2].country.value === 'United States');
				assert(res.body[2].country.valid === true);
				assert(res.body[2].valid === true);

				// Reused Email, resued@test.com, US
				assert.isObject(res.body[3]);
				assert.isObject(res.body[3].name);
				assert(res.body[3].name.value === 'Reused Email');
				assert(res.body[3].name.valid === true);
				assert(res.body[3].email.value === 'reused@test.com');
				assert(res.body[3].email.valid === true);
				assert(res.body[3].countryCode.value === 'US');
				assert(res.body[3].countryCode.valid === true);
				assert(res.body[3].country.value === 'United States');
				assert(res.body[3].country.valid === true);
				assert(res.body[3].valid === true);

				// Reused Email 2, resued@test.com, US
				assert.isObject(res.body[4]);
				assert.isObject(res.body[4].name);
				assert(res.body[4].name.value === 'Reused Email 2');
				assert(res.body[4].name.valid === true);
				assert(res.body[4].email.value === 'reused@test.com');
				assert(res.body[4].email.valid === false);
				assert(res.body[4].countryCode.value === 'US');
				assert(res.body[4].countryCode.valid === true);
				assert(res.body[4].country.value === 'United States');
				assert(res.body[4].country.valid === true);
				assert(res.body[4].valid === false);

				// Bad Country, bad@country.com, BLAH
				assert.isObject(res.body[5]);
				assert.isObject(res.body[5].name);
				assert(res.body[5].name.value === 'Bad Country');
				assert(res.body[5].name.valid === true);
				assert(res.body[5].email.value === 'bad@country.com');
				assert(res.body[5].email.valid === true);
				assert(res.body[5].countryCode.value === 'BLAH');
				assert(res.body[5].countryCode.valid === false);
				assert(res.body[5].country.value === '');
				assert(res.body[5].country.valid === false);
				assert(res.body[5].valid === false);

				// Not Email, blah, US
				assert.isObject(res.body[6]);
				assert.isObject(res.body[6].name);
				assert(res.body[6].name.value === 'Not Email');
				assert(res.body[6].name.valid === true);
				assert(res.body[6].email.value === 'blah');
				assert(res.body[6].email.valid === false);
				assert(res.body[6].countryCode.value === 'US');
				assert(res.body[6].countryCode.valid === true);
				assert(res.body[6].country.value === 'United States');
				assert(res.body[6].country.valid === true);
				assert(res.body[6].valid === false);

				done();
			});
	});

	it('returns the validated users with access levels', function (done) {
		agents.admin.request
			.post('/api/users/validate')
			.attach('users', __dirname + '/user_tests/test3.csv')
			.expect(200)
			.end(function (err, res) {
				if (err) {
					return done(err);
				}

				assert.isArray(res.body);
				assert(res.body.length == 10);
				res.body.forEach(function (user) {
					assert.isObject(user);
					assert.isObject(user.name);
					assert.isString(user.name.value);
					assert(user.name.valid === true);
					assert.isObject(user.email);
					assert.isString(user.email.value);
					assert(user.email.valid === true);
					assert.isObject(user.countryCode);
					assert.isString(user.countryCode.value);
					assert(user.countryCode.valid === true);
					assert.isObject(user.country);
					assert.isString(user.country.value);
					assert(user.country.valid === true);
					assert.isObject(user.access);
					assert.isObject(user.phones);
				});

				res.body.slice(0, 7).forEach(function (user) {
					assert(user.access.valid === true);
					assert(user.valid === true);
				});

				res.body.slice(7, 10).forEach(function (user) {
					assert(user.access.valid !== true);
					assert(user.valid !== true);
				});

				assert(res.body[0].access.value === 0);
				assert(res.body[1].access.value === 1);
				assert(res.body[2].access.value === 2);
				assert(res.body[3].access.value === 0);
				assert(res.body[4].access.value === 1);
				assert(res.body[5].access.value === 2);
				assert(res.body[6].access.value === 2);

				done();
			});
	});
});

describe('DELETE /api/requests/:requestId', function () {
	it('deletes a given request', function (done) {
		var rs = requestsWithName(requests, 'Ishaan Parikh', 'volunteer');
		assert(rs.length > 0);
		var request = rs[0];
		agents.volunteer.request
			.delete('/api/requests/' + request._id)
			.expect(200)
			.end(function (err) {
				if (err) {
					return done(err);
				}

				agents.volunteer.request
					.get('/api/requests/' + request._id)
					.expect(200, null)
					.end(done);
			});
	});

	it('non-requestee volunteers can not delete', function (done) {
		var rs = requestsWithName(requests, 'Jeff Hilnbrand', 'volunteer');
		assert(rs.length > 0);
		var request = rs[0];
		agents.volunteer.request
			.delete('/api/requests/' + request._id)
			.expect(401)
			.end(function (err) {
				if (err) {
					return done(err);
				}

				agents.admin.request
					.get('/api/requests/' + request._id)
					.expect(200)
					.end(function (err, res) {
						if (err) {
							return done(err);
						}

						assert.equal(res.body.volunteer.name, 'Jeff Hilnbrand');
						done();
					});
			});
	});
});

describe('DELETE /api/users/:userId', function () {
	it('deletes a given user', function (done) {
		var user = userWithName(users, 'John Doe');
		agents.admin.request
			.delete('/api/users/' + user._id)
			.expect(200)
			.end(function (err) {
				if (err) {
					return done(err);
				}

				agents.admin.request
					.get('/api/users/' + user._id)
					.expect(200, null)
					.end(done);
			});
	});

	it('volunteers cannot delete other volunteers', function (done) {
		var user = userWithName(users, 'Jeff Hilnbrand');
		agents.volunteer.request
			.delete('/api/users/' + user._id)
			.expect(401)
			.end(function (err) {
				if (err) {
					return done(err);
				}

				agents.admin.request
					.get('/api/users/' + user._id)
					.expect(200)
					.end(function (err, res) {
						if (err) {
							return done(err);
						}

						assert.equal(res.body.name, 'Jeff Hilnbrand');
						done();
					});
			});
	});
});

after(function (done) {
	server.close(function () {
		closeDatabase(function () {
			done();
		});
	});
});
