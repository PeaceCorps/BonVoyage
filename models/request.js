/* jshint node: true */
'use strict';

var mongoose = require("mongoose");
var DateOnly = require('mongoose-dateonly')(mongoose);

var request_schema = mongoose.Schema({
	email: String,
	status: {
		is_pending: Boolean,
		is_approved: Boolean
	},
	timestamp: {type: Date, default: Date.now},

	legs: [{
		start_date: DateOnly,
		end_date: DateOnly,
		country: String,
		country_code: String,
		hotel: String,
		contact: String,
		companions: String,
		description: String
	}],

	comments: [{
		name: String,
		email: String,
		content: String,
		timestamp: {type: Date, default: Date.now}
	}]
});

module.exports = mongoose.model("request",request_schema);
