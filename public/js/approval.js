/* global volunteer */
/* global format_time */
/* global format_dateonly */
/* global UTC_FORMAT_TIME */
/* global window */
/* global document */
/* global intlTelInputUtils */

// Dynamically disable the comment button if the textarea is empty
function commentStoppedTyping() { // jshint ignore:line
	'use strict';
	if($('#new-comment').val().length > 0) {
		$('#submit-comment').removeClass('disabled');
	} else {
		$('#submit-comment').addClass('disabled');
	}
}

$(function() {
	'use strict';
	// Format the dates for the trip itinerary
	$('.date').each(function(_, date) {
		var date_unf = $(date).data('unformatted');
		$(date).text(format_dateonly(date_unf));
	});
	// Format the timestamps for the comments
	$('.timestamp').each(function(_, time) {
		var time_unf = $(time).data('unformatted');
		$(time).text(format_time(time_unf, UTC_FORMAT_TIME));
	});
	// Set the link to the edit page
	$('.editLink').attr('href', document.location.href + '/edit');

	var defaultOption = {
		_id: 'none',
		isNone: true,
		name: 'None',
		label: 'Default',
		optgroup: 'noReviewer',
	};

	var $selectReviewer;

	function getApprovalFormData() {
		var data = {
			approval: $('#approvalCheckbox').is(':checked'),
			comment: $('#explanation').val(),
			reviewer: $selectReviewer.items[0],
		};
		return data;
	}

	function handleApprovalFormChange() {
		var approvalData = getApprovalFormData();
		var approvalText, archiveText, buttonClass, icon;
		if (approvalData.approval === true) {
			approvalText = 'Approve';
			buttonClass = 'btn-success';
		} else {
			approvalText = 'Deny';
			buttonClass = 'btn-danger';
		}

		if (approvalData.reviewer === 'none') {
			archiveText = 'Archive';
			icon = 'fa-archive';
		} else {
			archiveText = 'Re-Assign';
			icon = 'fa-envelope';
		}

		$('#request-approval-btn').removeClass('btn-success btn-danger');
		$('#request-approval-btn').addClass(buttonClass);
		$('#request-approval-btn').html('<span class="fa ' + icon + '"></span> ' + approvalText + ' and ' + archiveText);
	}

	if ($('#selectReviewer').length == 1) {
		$('input[type=radio]').change(handleApprovalFormChange);

		$selectReviewer = $('#selectReviewer').selectize({
			valueField: '_id',
			labelField: 'name',
			searchField: ['name'],
			lockOptgroupOrder: true,
			// Let the "None" field bubble up
			sortField: [ { field: 'isNone', direction: 'desc' }, { field: 'name' } ],
			optgroups: [
				{ value: 'noReviewer', label: 'No Reviewer **' },
				{ value: 'selectReviewer', label: 'Potential Reviewers' },
			],
			onChange: handleApprovalFormChange,
		})[0].selectize;

		$.ajax({
			method: "GET",
			url: "/api/users?minAccess=1&maxAccess=1",
			dataType: "json",
			success: function(json) {
				// Add the PC volunteer to the reviewer list
				json.push(volunteer);

				for (var i = 0; i < json.length; i++) {
					json[i].isNone = false;
					json[i].optgroup = 'selectReviewer';
				}
				// Add the default "None" option
				json.push(defaultOption);
				$selectReviewer.addOption(json);
				$selectReviewer.addItem(defaultOption._id);
				$selectReviewer.refreshOptions(false);
			}
		});
	}

	$('#submit-comment').click(function() {
		var url = '/api/requests' + document.location.href.substring(document.location.href.lastIndexOf('/')) + '/comments';
		var data = $('#new-comment').val();
		$.ajax({
			method: "POST",
			contentType: "application/x-www-form-urlencoded",
			url: url,
			data: { content: data },
			success: function(response) {
				if (response) {
					window.location.href = response.redirect;
				}
			}
		});
	});

	$('#request-approval-btn').click(function() {
		var url = '/api/requests' + document.location.href.substring(document.location.href.lastIndexOf('/')) + '/approval';
		$.ajax({
			method: "POST",
			contentType: "application/x-www-form-urlencoded",
			data: getApprovalFormData(),
			url: url,
			success: function(response) {
				if (response && response.redirect) {
					window.location.href = response.redirect;
				}
			}
		});
	});

	$('#request-deny-btn').click(function() {
		var url = '/api/requests' + document.location.href.substring(document.location.href.lastIndexOf('/')) + '/deny';
		$.ajax({
			method: "POST",
			contentType: "application/x-www-form-urlencoded",
			url: url,
			success: function(response) {
				if (response && response.redirect) {
					window.location.href = response.redirect;
				}
			}
		});
	});

	$('#request-delete-btn').click(function() {
		var url = '/api/requests' + document.location.href.substring(document.location.href.lastIndexOf('/'));
		$.ajax({
			method: "DELETE",
			contentType: "application/x-www-form-urlencoded",
			url: url,
			success: function(response) {
				if (response && response.redirect) {
					window.location.href = response.redirect;
				}
			}
		});
	});

	// Format the phone numbers
	$('span.phones').each(function() {
		var formattedPhones = [];
		$.each($(this).text().split(', '), function(_, phone) {
			var formattedPhone = intlTelInputUtils.formatNumber(phone, null, intlTelInputUtils.numberFormat.INTERNATIONAL);
			formattedPhones.push(formattedPhone);
		});
		$(this).text(formattedPhones.join(', '));
	});
});
