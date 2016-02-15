var mongoose = require("mongoose");

var token_schema = mongoose.Schema({
	token: {
		type: String,
		required: true
	},
	email: {
		type: String,
		required: true
	},
	timestamp: {
		type: Date,
		required: true,
		default: Date.now
	}
});

module.exports = mongoose.model("token",token_schema);
