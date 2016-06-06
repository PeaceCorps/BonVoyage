/* jshint node: true */
'use strict';
module.exports = function (done) {
	var User = require(__dirname + '/../models/user');

	var userbase = [
		{
			name: 'Colin King',
			email: 'colink@umd.edu',
			hash: 'colin',
			access: 2,
			countryCode: 'US',
			pending: false,
		},
		{
			name: 'Sean Bae',
			email: 's@seanbae.net',
			hash: 'sean',
			access: 2,
			countryCode: 'US',
			pending: false,
		},
		{
			name: 'Hiroshi Furuya',
			email: 'tairabox@gmail.com',
			hash: 'hiroshi',
			access: 2,
			countryCode: 'US',
			pending: false,
		},
		{
			name: 'Patrick Choquette',
			email: 'pchoquette@peacecorps.gov',
			hash: 'patrick',
			access: 1,
			countryCode: 'US',
			pending: false,
		},
		{
			name: 'Jane Smith',
			email: 'jane@test.com',
			hash: 'jane',
			access: 1,
			countryCode: 'BW',
			pending: false,
		},
		{
			name: 'John Doe',
			email: 'john@test.com',
			hash: 'john',
			access: 0,
			countryCode: 'BW',
			pending: false,
		},
		{
			name: 'Ishaan Parikh',
			email: 'ishaan@test.com',
			hash: 'ishaan',
			access: 0,
			countryCode: 'US',
			pending: false,
		},
		{
			name: 'Jeff Hilnbrand',
			email: 'jeff@test.com',
			hash: 'jeff',
			access: 0,
			countryCode: 'US',
			pending: false,
		},
		{
			name: 'Jake West',
			email: 'jake@test.com',
			hash: 'jake',
			access: 0,
			countryCode: 'US',
			pending: true,
		},
	];
	var users = [];
	var finished = 0;
	var handleSave = function (err, doc) {
		if (err) {
			done(err);
		} else {
			users.push(doc);
			finished += 1;
			if (finished == userbase.length) {
				done(null, users);
			}
		}
	};

	for (var i = userbase.length - 1; i >= 0; i--) {
		var user = new User(userbase[i]);
		user.save(handleSave);
	}
};
