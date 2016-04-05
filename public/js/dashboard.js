/* global FastClick */
/* global document */
/* global window */
/* global format_dateonly */
/* global setTimeout */
/* global DateOnly */
/* global currentUser */

$(function () {
	'use strict';

	function $table() {
		return $('div#dashboardTable table');
	}

	if ('FastClick' in window) {
		FastClick.attach(document.body);
	}

	// Track what has been toggled in the search filters
	var searchOptions = {
		show: {
			approved: true,
			denied: true,
			pending: true,
		},
		limit: {
			onLeave: false,
			assignedMe: false,
		},
	};

	// Configure the past and present DataTables indivudally
	var table = $table().DataTable({
		responsive: {
        details: false,
    },
		ajax: {
			url: '/api/requests',
			dataSrc: ''
		},
		order: [[5, 'desc'], [2, 'asc'], [0, 'asc']],
		dom:
			"<'row'>" +
			"<'row'<'col-sm-12'tr>>" +
			"<'row'<'col-sm-4 hidden-xs'i><'col-sm-8 col-xs-12'p>" +
				"<'col-xs-12 visible-xs'i>>",
		language: {
			emptyTable: 'No requests found.',
			infoFiltered: '(filtered from _MAX_ requests)',
			zeroRecords: 'No matching requests found',
			info: 'Showing _START_ to _END_ of _TOTAL_ requests',
			lengthMenu: 'Show _MENU_ requests',
		},
		columns: [
			{
				data: 'user',
				render: function (data) {
					if (data) {
						return data.name;
					} else {
						return 'None';
					}
				},
			},
			{
				data: 'staff',
				render: function (data) {
					if (data) {
						return data.name;
					} else {
						return 'None';
					}
				},
			},
			{
				data: 'startDate',
				render: function (data) {
					return format_dateonly(data);
				},
			},
			{
				data: 'endDate',
				render: function (data) {
					return format_dateonly(data);
				},
			},
			{
				data: 'legs',
				render: function (data) {
					var countries = '';
					var separator = '';
					for (var i = 0; i < data.length; i++) {
						var leg = data[i];
						countries += separator + leg.countryCode;
						separator = ', ';
					}

					return countries;
				},

				width: '20%',
			},
			{
				data: 'status',
				render: function (data) {
					return (data.isPending ? 'Pending' : (data.isApproved ? 'Approved' : 'Denied'));
				},
			},
			{
				data: 'legs',
				render: function (data) {
					var countries = '';
					var separator = '';
					for (var i = 0; i < data.length; i++) {
						var leg = data[i];
						countries += separator + leg.country;
						separator = ', ';
					}

					return countries;
				},

				visible: false,
			},
		],
		rowCallback: function (row, data) {

			// Add Bootstrap coloration
			if (data.status.isPending === true) {
				$(row).addClass('warning');
			} else {
				if (data.status.isApproved === true) {
					$(row).addClass('success');
				} else {
					$(row).addClass('danger');
				}
			}

			// Add click handler
			(function (data) {
				$(row).click(function () {
					window.location.href = '/requests/' + data._id;
				});
			})(data);
		},
	});

	$('.dropdown-menu a').on('click', function (event) {
		var $target = $(event.currentTarget),
			val = $target.attr('data-value'),
			$inp = $target.find('input');

		var split_val = val.split('.');
		if (split_val.length == 2) {
			var type = split_val[0];
			var value = split_val[1];
			searchOptions[type][value] = !searchOptions[type][value];
			setTimeout(function () {
				$inp.prop('checked', searchOptions[type][value]);
			}, 0);
		}

		$(event.target).blur();

		// Update the table
		table.draw();

		return false;
	});

	/* Custom filtering function which will filter data based on search filter */
	$.fn.dataTable.ext.search.push(
		function (settings, data, dataIndex) {
			var approval_status = data[5];

			if (
				(searchOptions.show.approved && approval_status == 'Approved') ||
				(searchOptions.show.denied && approval_status == 'Denied') ||
				(searchOptions.show.pending && approval_status == 'Pending')
			) {
				var rowData = table.rows({order:'original'}).data()[dataIndex];
				if (!searchOptions.limit.assignedMe ||
						currentUser._id == rowData.staffId) {
					if (searchOptions.limit.onLeave) {
						var start_date = new DateOnly(data[2]);
						var end_date = new DateOnly(data[3]);
						var today = new DateOnly();
						return today >= start_date && today <= end_date;
					} else {
						return true;
					}
				}
			}

			return false;
		}
	);

	$('#searchBar input[type=text]').keyup(function () {
		var q = $(this).val();
		table.search(q).draw();
	});

	$(window).on('resize', function() {
		table.responsive.recalc();
	});
});
