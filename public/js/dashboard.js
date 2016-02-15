
function $table() {
	return $('div#dashboardTable table');
}

$(function() {
	FastClick.attach(document.body);
	// Track what has been toggled in the search filters
	var search_options = {
		show: {
			approved: true,
			denied: true,
			pending: true
		},
		limit: {
			on_leave: false
		}
	};

	// Configure the past and present DataTables indivudally
	var table = $table().DataTable({
		// responsive: true, // TODO
		ajax: {
			url: '/api/requests',
			dataSrc: ''
		},
		order: [[4, 'desc'], [1, 'asc'], [0, 'asc']],
		dom: 
			"<'row'>" +
			"<'row'<'col-sm-12'tr>>" +
			"<'row'<'col-sm-4 hidden-xs'i><'col-sm-8 col-xs-12'p><'col-xs-12 visible-xs'i>>",
		language: {
			emptyTable: 'No requests found.',
			infoFiltered: "(filtered from _MAX_ requests)",
			zeroRecords: "No matching requests found",
			info: "Showing _START_ to _END_ of _TOTAL_ requests",
			lengthMenu: "Show _MENU_ requests"
		},
		columns: [
			{
				data: 'user',
				render: function(data, type, row) {
					if (data && data.length > 0) {
						return data[0].name;
					} else {
						return 'None';
					}
				}
			},
			{
				data: 'start_date',
				render: function(data, type, row) {
					return format_dateonly(data);
				}
			},
			{
				data: 'end_date',
				render: function(data, type, row) {
					return format_dateonly(data);
				}
			},
			{
				data: 'legs',
				render: function(data, type, row) {
					var countries = "";
					var separator = "";
					for (var i = 0; i < data.length; i++) {
						var leg = data[i];
						countries += separator + leg.country_code;
						separator = ", ";
					}
					return countries;
				},
				width: "20%"
			},
			{
				data: 'status',
				render: function(data, type, row) {
					return (data.is_pending ? "Pending" : (data.is_approved ? "Approved" : "Denied"));
				}
			},
			{
				data: 'legs',
				render: function(data, type, row) {
					var countries = "";
					var separator = "";
					for (var i = 0; i < data.length; i++) {
						var leg = data[i];
						countries += separator + leg.country;
						separator = ", ";
					}
					return countries;
				},
                "visible": false			
            },
		],
		"rowCallback": function( row, data, index ) {

			// Add Bootstrap coloration
			if (data.status.is_pending == true) {
				$(row).addClass('warning');
			} else {
				if (data.status.is_approved == true) {
					$(row).addClass('success');
				} else {
					$(row).addClass('danger');
				}
			}

			// Add click handler
			(function(data) {
				$(row).click(function(event) {
					// Pass the search query and filter options on to the approval page
					// so that the next/prev buttons can be set
					// var query_data = {
					// 	q: $('#searchBar input[type=text]').val(),
					// 	filters: search_options
					// }
					window.location.href = "/requests/" + data._id //+ "?" + $.param(query_data);
				});
			})(data);
		}
	});

	function updateSearch() {
		console.log(search_options);
	}

	$('.dropdown-menu a').on( 'click', function( event ) {
		var $target = $(event.currentTarget),
			val = $target.attr('data-value'),
			$inp = $target.find('input');

		var split_val = val.split('.');
		if(split_val.length == 2) {
			var type = split_val[0];
			var value = split_val[1];
			search_options[type][value] = !search_options[type][value]
			setTimeout( function() { $inp.prop('checked', search_options[type][value])}, 0);
		}

		$(event.target).blur();

		// Update the table
		table.draw();

		return false;
	});

	/* Custom filtering function which will search data in column four between two values */
	$.fn.dataTable.ext.search.push(
		function( settings, data, dataIndex ) {
			var approval_status = data[4];

			if(
				(search_options.show.approved && approval_status == "Approved") ||
				(search_options.show.denied && approval_status == "Denied") ||
				(search_options.show.pending && approval_status == "Pending")
			){
				if (search_options.limit.on_leave) {
					var start_date = new DateOnly(data[1]);
					var end_date = new DateOnly(data[2]);
					var today = new DateOnly();
					return today >= start_date && today <= end_date;
				} else {
					return true;
				}
			} else {
				return false;
			}
		}
	);

	$('#searchBar input[type=text]').keyup(function() {
		var q = $(this).val();
		table.search(q).draw();
	});
});

