/* globals window */
/* global window */
/* global currentUser */

$(function () {
	'use strict';

	function $table() {
		return $('div#usersTable table');
	}

	var url = '/api/users';

	if (currentUser.access === 1) {
		url = '/api/users?maxAccess=1&country=' + currentUser.countryCode;
	}

	// Configure the past and present DataTables indivudally
	var table = $table().DataTable({
		responsive: {
        details: false,
    },
		ajax: {
			url: url,
			dataSrc: '',
		},
		order: [[0, 'asc']],
		dom:
			"<'row'>" +
			"<'row'<'col-sm-12'tr>>" +
			"<'row'<'col-sm-4 hidden-xs'i><'col-sm-8 col-xs-12'p>" +
				"<'col-xs-12 visible-xs'i>>",
		language: {
			emptyTable: 'No users found.',
			infoFiltered: '(filtered from _MAX_ users)',
			zeroRecords: 'No matching users found',
			info: 'Showing _START_ to _END_ of _TOTAL_ users',
			lengthMenu: 'Show _MENU_ users',
			infoEmpty: 'Showing 0 to 0 of 0 users',
		},
		columns: [
			{
				data: 'name',
			},
			{
				data: 'email',
			},
			{
				data: 'country',
			},
			{
				data: 'access',
				render: function(data) {
					if(data === 0) { return "Volunteer"; }
					else if(data === 1) { return "Staff"; }
					else if(data === 2) { return "Admin"; }
					else { return "None"; }
				},
			},
			{
				data: 'pending',
				render: function(data) {
					console.log(data);
					if (data) {
						return '<span class="label label-warning pendingLabel">Pending</span>';
					} else {
						return '<span class="label label-success pendingLabel">Verified</span>';
					}
				},
			},
			{
				data: 'countryCode',
				visible: false,
			},
		],
		rowCallback: function (row, data) {
			// Add click handler
			(function (data) {
				$(row).click(function () {
					window.location.href = '/profile/' + data._id;
				});
			})(data);
		},
	});

	$('#searchBar input[type=text]').keyup(function () {
		var q = $(this).val();
		table.search(q).draw();
	});

	$(window).on('resize', function() {
		table.responsive.recalc();
	});
});

//
// $(function() {
// 	'use strict';
//
// 	function getIdForButton(button) {
// 		return $(button).closest('.list-group-item').find('.id').text();
// 	}
// 	function getNameForButton(button) {
// 		return $(button).closest('.list-group-item').find('.name').text();
// 	}
// 	function getAccessForButton(button) {
// 		return $(button).closest('.list-group-item').data('access');
// 	}
//
// 	// Handle Deletion requests
// 	$('.delete:not(.disabled)').click(function() {
// 		if(confirm('Are you sure that you want to delete ' +
// 			getNameForButton(this) + '\'s account?')) {
// 			$.ajax({
// 				method: 'DELETE',
// 	            contentType: "application/x-www-form-urlencoded",
// 				data: {
// 					userId: getIdForButton(this),
// 				},
// 				url: '/api/users',
// 				dataType: 'json',
// 				success: function(response) {
// 					if (response && response.redirect) {
// 	                    window.location.href = response.redirect;
// 					}
// 				}
// 			});
// 		}
// 	});
//
// 	// Handle Promotion & Demotion Requests
// 	$('.promote:not(.disabled), .demote:not(.disabled)').click(function() {
// 		$.ajax({
// 			method: 'POST',
//             contentType: "application/x-www-form-urlencoded",
// 			data: {
// 				userId: getIdForButton(this),
// 				access: getAccessForButton(this) + ($(this).hasClass('promote') ? 1: -1)
// 			},
// 			url: '/api/access',
// 			dataType: 'json',
// 			success: function(response) {
// 				if (response && response.redirect) {
//                     window.location.href = response.redirect;
// 				}
// 			}
// 		});
// 	});
//
// 	// Handle clicking on a user
// 	$('.name').on('click', function() {
// 		var href = $(this).attr('href');
// 		if(href) {
// 			window.location.href = href;
// 		}
// 	});
// });
