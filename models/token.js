/* jshint node: true */
'use strict';

var mongoose = require('mongoose');
var tokenTypes = require(__dirname + '/../config/token-types');

var tokenSchema = mongoose.Schema({
	token: {
		type: String,
		required: true,
	},
	user: {
		type: mongoose.Schema.Types.ObjectId,
		required: true,
		ref: 'user',
	},
	tokenType: {
		type: String,
		required: true,
		enum: [tokenTypes.PASSWORD_RESET, tokenTypes.REGISTER],
	},
	timestamp: {
		type: Date,
		required: true,
		default: Date.now,
	},
});

module.exports = mongoose.model('token', tokenSchema);
