/* jshint node: true */
'use strict';

var mongoose = require('mongoose');
var DateOnly = require('mongoose-dateonly')(mongoose);

var countries = require(__dirname + '/../config/countries');

var requestSchema = mongoose.Schema({
	volunteer: { type:
		mongoose.Schema.Types.ObjectId,
		required: true,
		ref: 'user',
	},
	reviewer: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'user',
	},
	status: {
		isPending: Boolean,
		isApproved: Boolean,
	},
	timestamp: { type: Date, default: Date.now },

	legs: [
		{
			startDate: DateOnly,
			endDate: DateOnly,
			city: String,
			country: {
				type: String,
				required: true,
				enum: countries.countryList,
			},
			countryCode: {
				type: String,
				required: true,
				enum: countries.codeList,
			},
			hotel: String,
			contact: String,
			companions: String,
			description: String,
		},
	],

	comments: [
		{
			name: String,
			user: {
				type: mongoose.Schema.Types.ObjectId,
				ref: 'user',
			},
			content: String,
			timestamp: { type: Date, default: Date.now },
		},
	],

	counterpartApproved: Boolean,
});

module.exports = mongoose.model('request', requestSchema);
