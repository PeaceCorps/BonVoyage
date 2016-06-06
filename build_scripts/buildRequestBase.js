/* jshint node: true */
'use strict';

module.exports = function (options, done) {
	var Access = require(__dirname + '/../config/access');
	var ipsum = require('lorem-ipsum');
	var moment = require('moment');
	var DateOnly = require('dateonly');
	var countries = require(__dirname + '/../config/countries');
	var nCountries = countries.codeList.length;
	var User = require(__dirname + '/../models/user');
	var Request = require(__dirname + '/../models/request');
	var seedrandom = require('seedrandom');

	var REQUESTS_TO_GENERATE = options.nrequests || 100;
	var SEED = options.seed || 12345;
	var RANDOM = options.random;

	var rng = seedrandom(SEED);

	function randIndex(length) {
		return Math.floor(rng() * length);
	}

	// Returns boolean with cutoff% likeliehood of being true
	// Defaults to 0.5
	function randBool(cutoff) {
		return rng() < (cutoff ? cutoff : 0.5);
	}

	function randCountryCode() {
		return countries.codeList[randIndex(nCountries)];
	}

	function randDatePair() {
		var timeUntilLeave = randIndex(200) - 20;
		var start = moment();
		start.add(timeUntilLeave, 'days');
		var lengthOfVacation = randIndex(20);
		var end = moment(start);
		end.add(lengthOfVacation, 'days');
		return [new DateOnly(start), new DateOnly(end)];
	}

	function generateLeg() {
		var cc = randCountryCode();
		var dates = randDatePair();
		return {
			startDate: dates[0],
			endDate: dates[1],
			city: ipsum({ count: 1, units: 'words' }),
			country: countries.countries[cc],
			countryCode: cc,
			hotel: ipsum(),
			contact: '+14437654321',
			companions: ipsum(),
			description: ipsum({ count: randIndex(3), units: 'sentences' }),
		};
	}

	function generateRequest(user, reviewer) {
		var isPending = randBool(0.3);
		var isApproved = (isPending ? undefined : randBool(0.7));
		var legs = [];
		while (legs.length === 0 || randBool(0.4)) {
			legs.push(generateLeg());
		}

		return new Request({
			volunteer: user,
			reviewer: reviewer,
			status: {
				isPending: isPending,
				isApproved: isApproved,
			},
			legs: legs,
			comments: [],
			counterpartApproved: true,
		});
	}

	function saveAll(objects) {
		var count = objects.length;
		var handleSave = function (err) {
			if (err) {
				done(err);
			} else {
				count -= 1;

				if (count === 0) {
					done(null, objects);
				}
			}
		};

		for (var i = 0; i < objects.length; i++) {
			var object = objects[i];
			object.save(handleSave);
		}
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

	User.find({  }, function (err, users) {
		if (err) {
			done(err);
		} else {
			var volunteers = [];
			var staff = [];
			for (var i = 0; i < users.length; i++) {
				if (users[i].access == Access.VOLUNTEER) {
					volunteers.push(users[i]);
				} else {
					staff.push(users[i]);
				}
			}

			var requests = [];
			if (RANDOM) {
				for (i = 0; i < REQUESTS_TO_GENERATE; i++) {
					var randVolunteer = users[randIndex(volunteers.length)];
					var randStaff = staff[randIndex(staff.length)];
					requests.push(generateRequest(randVolunteer, randStaff));
				}
			} else {
				var getRequestForName = function (name) {
					return new Request({
						volunteer: userWithName(volunteers, name)._id,
						reviewer: userWithName(staff, 'Patrick Choquette')._id,
						status: {
							isPending: true,
							isApproved: false,
						},
						legs: [
							{
								startDate: 'May 3, 2016',
								endDate: 'May 10, 2016',
								city: 'Chicago',
								country: countries.countries.US,
								countryCode: 'US',
								hotel: 'Test Hotel',
								contact: '+14437654321',
								companions: 'Test Companion',
								description: 'Test Description',
							},
						],
						comments: [
							{
								name: 'Patrick Choquette',
								user: userWithName(staff, 'Patrick Choquette')._id,
								content: 'Thank you for submitting your request through BonVoyage.',
							},
						],
						counterpartApproved: true,
					});
				};

				requests = [
					getRequestForName('Ishaan Parikh'),
					getRequestForName('Jeff Hilnbrand'),
					getRequestForName('John Doe'),
				];
			}

			saveAll(requests);
		}
	});
};
