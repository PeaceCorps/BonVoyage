/* jshint node: true */
'use strict';

var mongoose = require('mongoose');
var bcrypt = require('bcrypt-nodejs');

var Access = require(__dirname + '/../config/access');
var countries = require(__dirname + '/../config/countries');

var userSchema = mongoose.Schema({
	name: {
		type: String,
		required: true,
	},

	email: {
		type: String,

		// Prevent MongoDB from ever saving two duplicate emails
		index: {
			unique: true,
		},
	},
	phones: [String],
	hash: String,
	access: {
		type: Number,
		required: true,
		enum: Object.keys(Access),
	},
	countryCode: {
		type: String,
		required: true,
		enum: countries.codeList,
	},
	pending: {
		type: Boolean,
		required: true,
	},
});

var presave = function (callback) {
	var _this = this;
	bcrypt.genSalt(10, function (err, salt) {
		// new passwords are set to the hash and then overwritten below
		var plainTextPassword = _this.hash;
		bcrypt.hash(plainTextPassword, salt, null, function (err, passwordHash) {
			// console.log(passwordHash);
			_this.hash = passwordHash;
			callback();
		});
	});
};

userSchema.methods.comparePassword = function (password, cb) {
	var _this = this;
	bcrypt.compare(password, _this.hash, cb);
};

userSchema.pre('save', presave);

module.exports = mongoose.model('user', userSchema);
