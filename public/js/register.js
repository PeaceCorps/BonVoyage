/* globals document */

function isValid(reference) {
	'use strict';
	reference.css('border', '3px solid #1FDA9A');
}

function isNotValid(reference) {
	'use strict';
	reference.css('border', '3px solid #DB3340');
}

function validate(reference, validate) {
	'use strict';
	if (reference && reference.val() === '') {
		reference.css('border', '1px solid #ccc');
		return false;
	}

	if (reference && validate) {
		isValid(reference);
		return true;
	} else {
		isNotValid(reference);
		return false;
	}
}

var enableBtn = function() {
	'use strict';
	document.getElementById('signupInfo').disabled = false;
};

$(function () {
	'use strict';

	// initialize phone field
	var password = $('#signupPassword');
	var rePassword = $('#signupPassword2');

	var handleKeyup = function() {
		var password1 = password.val();
		var password2 = rePassword.val();

		var valid = validate(password, password1 !== '' && password1 === password2);
		validate(rePassword, password1 !== '' && password1 === password2);

		if (valid) {
			enableBtn();
		}
	};

	password.on('keyup change', handleKeyup);
	rePassword.on('keyup change', handleKeyup);
});
