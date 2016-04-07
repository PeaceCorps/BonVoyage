/* jshint node: true */
'use strict';

require(__dirname + '/../setup');

var mongoose = require('mongoose');
var uuid = require('node-uuid');
var Warning = require(__dirname + '/../models/warning');

mongoose.connect(process.env.DATABASE_URL);

function removeAll(newBatchUUID, source) {
	console.log('Removing all ' + source +
		' warnings except batch: ' + newBatchUUID);
	Warning.find({ source: source, batchUUID: { $ne: newBatchUUID } })
		.remove()
		.exec(function (err, response) {
		if (err) {
			console.error('An error occurred while attempting to remove ' +
				source + ' warnings.');
			throw err;
		} else {
			console.log('Removed ' + response.result.n + ' ' + source + ' warnings.');
			mongoose.connection.close();
		}
	});
}

var storeWarnings = function (warnings) {
	var batchUUID = uuid.v1();
	var count = warnings.length;

	function onFinish(doc, source) {
		return function (err) {
			count--;
			if (err) {
				console.error('(Batch: ' + batchUUID +
					'): Inserting the following warning failed:');
				console.error(doc);
				console.error(err);
			}

			if (count === 0) {
				removeAll(batchUUID, source);
			}
		};
	}

	if (count > 0) {
		var source = warnings[0].source;
		console.log('Inserting ' + count + ' warnings (Batch: ' + batchUUID + ')');

		for (var i = 0; i < warnings.length; i++) {
			warnings[i].batchUUID = batchUUID;
			new Warning(warnings[i]).save(onFinish(warnings[i], source));
		}
	}
};

module.exports = storeWarnings;
