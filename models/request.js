/* jshint node: true */
'use strict';

var mongoose = require('mongoose');
var DateOnly = require('mongoose-dateonly')(mongoose);

var requestSchema = mongoose.Schema({
	userId: { type: mongoose.Schema.Types.ObjectId, required: true, },
	staffId: { type: mongoose.Schema.Types.ObjectId, required: true, },
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
			country: String,
			countryCode: String,
			hotel: String,
			contact: String,
			companions: String,
			description: String,
		},
	],

	comments: [
		{
			name: String,
			userId: mongoose.Schema.Types.ObjectId,
			content: String,
			timestamp: { type: Date, default: Date.now },
		},
	],

	counterpartApproved: Boolean,
});

module.exports = mongoose.model('request', requestSchema);
