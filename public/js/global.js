
var UTC_FORMAT = 'ddd MMM DD YYYY';
var UTC_FORMAT_TIME = 'ddd MMM DD YYYY HH:mm:ss zZZ';
var ISO_FORMAT = 'YYYY-MM-DD';
var DISPLAY_FORMAT = "MMM DD, YYYY";
var PICKADATE_DISPLAY_FORMAT = "mmm dd, yyyy";
var warnings = undefined;

function format_time(time, format) {
	if (time === undefined) {
		return "None";
	} else {
		return moment(time, format).format("LLL");
	}
}

function format_dateonly(date) {
	if (date == undefined) {
		return "None";
	} else {
		var date = new DateOnly(date);
		return moment(date.toDate()).format(DISPLAY_FORMAT);
	}
}

// http://stackoverflow.com/questions/196972/convert-string-to-title-case-with-javascript
function toTitleCase(str) {
    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

/*
 * The first time that this function is called, the warnings
 * will be fetched from the server. Every time after, the warnings 
 * will be cached.
 */
function getWarnings(callback) {
	// Laze load the warnings from the server
	if (warnings) {
		if (callback) 
			callback(warnings);
	} else {
		$.ajax({
			url: "/data/warnings.json",
			dataType: "json",
			success: function(warnings, resp_string, jqXHR) {
				if (callback) 
					callback(warnings);
			}
		});
	}
}

$(function() {
	$('#logout').click(function() {
		$.ajax({
			method: "POST",
			url: "/api/logout",
			dataType: "json",
			success: function(resp) {
				if (resp.redirect)
					window.location.href = resp.redirect;
			}
		});
	});
});