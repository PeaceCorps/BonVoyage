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
		},
		{
			name: 'Sean Bae',
			email: 's@seanbae.net',
			hash: 'sean',
			access: 2,
			countryCode: 'US',
		},
		{
			name: 'Hiroshi Furuya',
			email: 'tairabox@gmail.com',
			hash: 'hiroshi',
			access: 2,
			countryCode: 'US',
		},
		{
			name: 'Patrick Choquette',
			email: 'pchoquette@peacecorps.gov',
			hash: 'patrick',
			access: 1,
			countryCode: 'US',
		},
		{
			name: 'Jane Smith',
			email: 'jane@test.com',
			hash: 'jane',
			access: 1,
			countryCode: 'BW',
		},
		{
			name: 'John Doe',
			email: 'john@test.com',
			hash: 'john',
			access: 0,
			countryCode: 'BW',
		},
		{
			name: 'Ishaan Parikh',
			email: 'ishaan@test.com',
			hash: 'ishaan',
			access: 0,
			countryCode: 'US',
		},
		{
			name: 'Jeff Hilnbrand',
			email: 'jeff@test.com',
			hash: 'jeff',
			access: 0,
			countryCode: 'US',
		},
	];

	var finished = 0;
	var handleSave = function (err) {
		if (err) {
			done(err);
		} else {
			finished += 1;
			if (finished == userbase.length) {
				done(null);
			}
		}
	};

	for (var i = userbase.length - 1; i >= 0; i--) {
		var user = new User(userbase[i]);
		user.save(handleSave);
	}
};
