
// Dynamically disable the comment button if the textarea is empty
function commentStoppedTyping() {
	if($('#new-comment').val().length > 0) {
		$('#submit-comment').removeClass('disabled');
	} else {
		$('#submit-comment').addClass('disabled');
	}
}

$(function() {
	// Format the dates for the trip itinerary
	$('.date').each(function(_, date) {
		var date_unf = $(date).data('unformatted');
		$(date).text(format_date(date_unf));
	});
	// Format the timestamps for the comments
	$('.timestamp').each(function(_, time) {
		var time_unf = $(time).data('unformatted');
		$(time).text(format_time(time_unf));
	});

	
    $('#request-approve-btn').click(function() {
    	var url = '/api/requests' + document.location.href.substring(document.location.href.lastIndexOf('/')) + '/approve'
        $.ajax({
            method: "POST",
            contentType: "application/x-www-form-urlencoded",
            url: url,
            success: function(response, textStatus, jqXHR) {
                if (response) {
                	window.location.href = JSON.parse(response).redirect;
                }
            }
        });
    });

    $('#request-deny-btn').click(function() {
    	var url = '/api/requests' + document.location.href.substring(document.location.href.lastIndexOf('/')) + '/deny'
        $.ajax({
            method: "POST",
            contentType: "application/x-www-form-urlencoded",
            url: url,
            success: function(response, textStatus, jqXHR) {
                if (response) {
                    window.location.href = JSON.parse(response).redirect;
                }
            }
        });
    });

    $('#request-delete-btn').click(function() {
    	var url = '/api/requests' + document.location.href.substring(document.location.href.lastIndexOf('/')) + '/delete'
        $.ajax({
            method: "POST",
            contentType: "application/x-www-form-urlencoded",
            url: url,
            success: function(response, textStatus, jqXHR) {
                if (response) {
                    window.location.href = JSON.parse(response).redirect;
                }
            }
        });
    });

});

