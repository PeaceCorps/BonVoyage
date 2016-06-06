/* globals window */
/* globals document */

var enableBtn = function() { // jshint ignore:line
	'use strict';
	document.getElementById('submitInfo').disabled = false;
};

$(function() {
	'use strict';
	$('#submitInfo').click(function(e) {
		e.preventDefault();
		var email = $('#inputEmail').val();
		$.ajax({
			method: 'POST',
			contentType: 'application/x-www-form-urlencoded',
			data: {
				email: email
			},
			url: '/api/reset',
			dataType: 'json',
			success: function(response) {
				if (response && response.redirect) {
					window.location.href = response.redirect;
				}
			}
		});
	});
});
