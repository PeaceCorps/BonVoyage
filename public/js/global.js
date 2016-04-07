/* globals window */
/* globals moment */
/* globals DateOnly */

var UTC_FORMAT = 'ddd MMM DD YYYY';
var UTC_FORMAT_TIME = 'ddd MMM DD YYYY HH:mm:ss zZZ';
var ISO_FORMAT = 'YYYY-MM-DD';
var DISPLAY_FORMAT = "MMM DD, YYYY";
var PICKADATE_DISPLAY_FORMAT = "mmm dd, yyyy";
var warnings;

function format_time(time, format) {
	'use strict';
	if (time === undefined) {
		return "None";
	} else {
		return moment(time, format).format("LLL");
	}
}

function format_dateonly(date) {
	'use strict';
	if (date === undefined) {
		return "None";
	} else {
		var newDate = new DateOnly(date);
		return moment(newDate.toDate()).format(DISPLAY_FORMAT);
	}
}

// http://stackoverflow.com/questions/196972/convert-string-to-title-case-with-javascript
function toTitleCase(str) {
	'use strict';
	return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

/*
 * The first time that this function is called, the warnings
 * will be fetched from the server. Every time after, the warnings
 * will be cached.
 */
function getWarnings(callback) {
	'use strict';
	// Laze load the warnings from the server
	if(!warnings) {
		$.ajax({
			url: "/api/warnings",
			dataType: "json",
			success: function(w) {
				warnings = w;
				if(callback) {
					callback(warnings);
				}
			}
		});
	} else {
		callback(warnings);
	}
}

$(function() {
	'use strict';
	$('#logout').click(function() {
		$.ajax({
			method: "POST",
			url: "/api/logout",
			dataType: "json",
			success: function(resp) {
				if (resp.redirect) {
					window.location.href = resp.redirect;
				}
			}
		});
	});
});
