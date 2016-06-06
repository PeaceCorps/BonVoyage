/* jshint multistr: true */
/* globals moment */
/* globals DateOnly */
/* globals window */
/* globals getWarnings */
/* globals submissionData */
/* globals signedInUser */
/* globals PICKADATE_DISPLAY_FORMAT */

$(function() {
  "use strict";
  var count = 0; // 1 indexed count (decreases when legs are removed)
  var addedLegCount = -1; // 0 indexed count (doesn't decrease when legs are removed)
  var arrCountries = [];
  var users = null;
  var selectedUser = signedInUser.access === 0 ? signedInUser : null;

  function insertAtIndex(i, id, data) {
      if(i === 1) {
          return $(id).prepend(data);
      } else {
          return $(id + " > *:nth-child(" + (i - 1) + ")").after(data);
      }
  }

  function handleTripLegChanges() {
      // Update trip leg numbers to reflect deleted legs
      var c = 1;
      $('.leg').each(function(_, leg) {
          $(leg).removeClass().addClass('leg shadow-box leg' + c);
          $(leg).find('h2').text("Trip Leg #" + c);
          c++;
      });
      // Disable the remove leg buttons, if necessary
      if (count == 1) {
          $('.remove-leg').addClass('disabled');
      } else {
          $('.remove-leg').removeClass('disabled');
      }
  }

  function clearWarnings($warnings) {
      $($warnings).empty();
  }

  function addWarning(warning, $warnings) {
      $($warnings).append(
          $(
              "<div class='warning alert " + warning.colorClass + "' role='alert'> \
                  <span><span class='glyphicon glyphicon-exclamation-sign' aria-hidden='true'></span><b>" + warning.source + " - " + warning.type + ": </b> " + warning.textOverview + " <b><a target='_blank' rel='noopener noreferrer' href='" + warning.link + "'>More Information</a></b></span> \
              </div>"
          )
      );
  }

  function initialize(n) {
      // Initialize the Pick a Date picker
      $('.leg:nth-child(' + n + ') .datepicker').pickadate({
          format: PICKADATE_DISPLAY_FORMAT,
      });
      $('.leg:nth-child(' + n + ') .datepicker').each(function() {
          if($(this).val()) {
              $(this).pickadate('picker').set('select', new Date($(this).val()));
          }
      });
      // Initialize the Selectize country selector
      var $select = $('.leg:nth-child(' + n + ') .select-country').selectize({
          valueField: 'country_code',
          labelField: 'country',
          searchField: ['country', 'country_code'],
          sortField: 'country'
      });

      var selectize = $select[0].selectize;
      selectize.addOption(arrCountries);
      selectize.refreshOptions(false);

      // Add remove leg buttons
      $('.remove-leg').off('click');
      $('.remove-leg').on('click', function() {
          $(this).closest($('.leg')).remove();
          count--;
          handleTripLegChanges();
      });

      // Show a warning if one exists when the select is clicked
      selectize.on('item_add', function(country_code, $item) {
          // Get a selector for the warnings div, specific to the leg where the country was selected
          var $warnings = $($item).closest($('.leg')).find('.warnings');
          // Clear all warnings
          clearWarnings($warnings);

          getWarnings(function(warnings) {
              // Get the warnings for the selected country
              var country_warnings = warnings[country_code];
              if (country_warnings) {
                  for(var i = 0; i < country_warnings.length; i++) {
                      // Add a warning for each country
                      addWarning(country_warnings[i], $warnings);
                  }
              }
          });
      });

      $('.contact').intlTelInput({
        utilsScript: '/js/utils.js',
      });

      $('.contact').on('propertychange change click keyup input paste', function () {
        var formVal = $('.contact').val();
        var notValidNumber = !($('.contact').intlTelInput('isValidNumber'));

        if (formVal.length === 0) {
          $('#request-submit-btn').prop('disabled', false);
          $('.contact').removeClass('invalid-form');
          return;
        }

        if (formVal.length > 0 && notValidNumber) {
          // disable button
          $('#request-submit-btn').prop('disabled', true);
          $('.contact').addClass('invalid-form');
        } else {
          // enable button
          $('#request-submit-btn').prop('disabled', false);
          $('.contact').addClass('valid-form');
        }
      });
  }

  function addLeg(leg) {
      count++; addedLegCount++;
      var defaultStart, defaultEnd, defaultContact = '';
      var m = new moment();
      m.add(1, 'month');
      // If this is not the first leg, use the previous leg to define the default dates
      if (count > 1) {
        // Get the end date from the previous request
        var prevLeg = $('.leg:nth-child(' + (count - 1) + ')');
        var prevEnd = $(prevLeg).find('.date-returning').val();
        if (prevEnd) {
          m = new moment(new DateOnly(prevEnd).toDate());
        }
        var prevContactInput = $(prevLeg).find('.contact');
        if ($(prevContactInput).intlTelInput('isValidNumber')) {
          defaultContact = $(prevContactInput).intlTelInput('getNumber');
        }
      }
      defaultStart = new DateOnly(m);
      m.add(4, 'days');
      defaultEnd = new DateOnly(m);
      var html =
      "<div class='leg shadow-box'> \
          <h2> Trip Leg #" + count + " </h2> \
          <input class='addedLegCount hidden' value='" + addedLegCount + "'> \
          <label class='info'>Date leaving site <span class='required'>*<span></label> \
          <input class='form-control datepicker date-leaving' type='text' placeholder='Jan 1, 2000', value='" + (leg && leg.startDate ? leg.startDate : defaultStart.toString()) + "'> \
          <label class='info'>Date returning to site <span class='required'>*<span></label> \
          <input class='form-control datepicker date-returning' type='text' placeholder='Dec 31, 2000', value='" + (leg && leg.endDate ? leg.endDate : defaultEnd.toString()) + "'> \
          <label class='info'>Destination City <span class='required'>*<span></label> \
          <input class='form-control city' type='text' placeholder='Chicago' value='" + (leg && leg.city ? leg.city : '') + "'></input> \
          <label class='info'>Destination Country <span class='required'>*<span></label> \
          <select class='form-control select-country' placeholder='United States'></select> \
          <div class='warnings'></div> \
          <label class='info'>Best number to reach you at during travel</label> \
          <input class='form-control contact' type='tel' value='" + (leg && leg.contact ? leg.contact : defaultContact) + "'></input> \
          <label class='info'>Hotel/Hostel Information</label> \
          <input class='form-control hotel' type='text' placeholder='San Francisco Hotel: +1 123-456-7890' value='" + (leg && leg.hotel ? leg.hotel : '') + "'></input> \
          <label class='info'>Travel companions</label> \
          <input class='form-control companions' type='text' placeholder='John Doe: +1 123-456-7890' value='" + (leg && leg.companions ? leg.companions : '') + "'></input> \
          <label class='info'>Reason for leave</label> \
          <input class='form-control description' rows='6' type='text' placeholder='Emergency sick leave' value='" + (leg && leg.description ? leg.description : '') + "'></input> \
          <button class='btn btn-danger remove-leg'> Remove Trip Leg </button> \
      </div>";
      insertAtIndex(count, '#request-submit', html);
      handleTripLegChanges();
      initialize(count);
  }

  function getLeg(n) {
      var leg = $('.leg:nth-child(' + n + ')');
      var start = $(leg).find('.date-leaving').val();
      var end = $(leg).find('.date-returning').val();
      var isValidNumber = $(leg).find('.contact').intlTelInput('isValidNumber');
      var data = {
          startDate: (start ? (new DateOnly(start).toString()) : undefined),
          endDate: (end ? (new DateOnly(end).toString()) : undefined),
          city: $(leg).find('.city').val(),
          country: $(leg).find('.selectized').selectize()[0].selectize.getValue(),
          hotel: $(leg).find('.hotel').val(),
          contact: isValidNumber ? $(leg).find('.contact').intlTelInput('getNumber') : '',
          companions: $(leg).find('.companions').val(),
          description: $(leg).find('.description').val(),
          addedLegCount: $(leg).find('.addedLegCount').val(),
      };

      return data;
  }

  function isSubmitAsOtherUserShowing() {
      return $('#selectRequestee').length > 0;
  }

  function submissionDataExists() {
      return !$.isEmptyObject(submissionData);
  }
  $('.select-country').selectize();

  var $selectReviewer = $('#selectReviewer').selectize({
      valueField: '_id',
      labelField: 'name',
      searchField: ['name'],
      sortField: 'name'
  });

  function updateVolunteerName(volunteer) {
    if (volunteer) {
      $('#submissionName').text(' (' + volunteer.name + ') ');
      if (selectedUser) {
        $selectReviewer[0].selectize.updateOption(selectedUser._id, volunteer);
      } else {
        $selectReviewer[0].selectize.addOption(volunteer);
      }
      $selectReviewer[0].selectize.refreshOptions(false);
    }
  }

  var $selectRequestee = $('#selectRequestee').selectize({
      valueField: '_id',
      labelField: 'name',
      searchField: ['name'],
      sortField: 'name',
      onChange: function(value) {
        var volunteer = $selectRequestee[0].selectize.options[value];
        updateVolunteerName(volunteer);
        selectedUser = volunteer;
      }
  });

  if (isSubmitAsOtherUserShowing()) {
      $.ajax({
          method: "GET",
          url: "/api/users?maxAccess=0",
          dataType: "json",
          success: function(json) {
            users = json;
            $selectRequestee[0].selectize.addOption(json);
            $selectRequestee[0].selectize.refreshOptions(false);
            if(submissionDataExists()) {
                // A failure just occurred during submission: we need to replace the previously submitted data
                if (submissionData.volunteer !== undefined) {
                  $selectRequestee[0].selectize.setValue(submissionData.volunteer);
                  var volunteer = $selectRequestee[0].selectize.options[submissionData.volunteer];
                  updateVolunteerName(volunteer);
                }
            }
          }
      });
  }

  $.ajax({
      method: "GET",
      url: "/api/users?minAccess=1&maxAccess=1",
      dataType: "json",
      success: function(json) {
        // If a user is selected, add them as an option to be a reviewer
        // Except don't give volunteers the option to assign themselves on the submission page
        if (selectedUser &&
          (signedInUser.access !== 0 || window.location.pathname !== '/dashboard/submit')) {
          json.push(selectedUser);
        }
        $selectReviewer[0].selectize.addOption(json);
        $selectReviewer[0].selectize.refreshOptions(false);
        if(submissionDataExists()) {
            // A failure just occurred during submission: we need to replace the previously submitted data
            if (submissionData.reviewer !== undefined) {
                $selectReviewer[0].selectize.setValue(submissionData.reviewer);
            }
        }
      }
  });

  // Load the JSON file of the countries
  $.ajax({
      method: "GET",
      url: "/data/countryList.json",
      datatype: "json",
      success: function(json) {
          for(var key in json) {
              arrCountries.push({ "country": json[key], "country_code": key });
          }

          var $select = $('.select-country.selectized').selectize();
          $select.each(function(_, $s) {
              $s.selectize.addOption(arrCountries);
              $s.selectize.refreshOptions(false);
          });

          if(submissionDataExists()) {
              // A failure just occurred during submission: we need to replace the previously submitted data
              for(var i = 0; i < $select.length; i++) {
                  $select[i].selectize.setValue(submissionData.legs[i].country);
              }
          }
      }
  });

  if(submissionDataExists()) {
      // A failure just occurred during submission: we need to replace the previously submitted data
      // Create all of the legs, and fill what data can be filled without the above AJAX calls finishing (countries, submit as other user)
      for (var i = 0; i < submissionData.legs.length; i++) {
          var leg = submissionData.legs[i];
          addLeg(leg);
      }
      // Set counterpart approval checkbox
      $('#approvalCheckbox').prop('checked', submissionData.counterpartApproved === "true");
  } else {
      // Start the request with a single trip leg
      addLeg();
  }

  // Load the warnings
  getWarnings();

  $('#request-add-leg-btn').click(addLeg);

  $('#request-submit-btn').click(function() {
      var legs = [];
      for (var i = 1; i <= count; i++) {
          legs.push(getLeg(i));
      }
      var volunteer;
      if (isSubmitAsOtherUserShowing()) {
          volunteer = $selectRequestee[0].selectize.getValue();
      }
      var reviewer = $selectReviewer[0].selectize.getValue();
      var counterpartApproved = $('#approvalCheckbox').is(':checked');

      var url = '/api/requests';
      var curr_url = window.location.href;
      var regex = curr_url.match('^.*/requests/([0-9a-f]{24})/edit$');
      if (regex !== null && regex.length > 1) {
        url = '/api/requests/' + regex[1];
      }

      $.ajax({
          method: "POST",
          contentType: "application/x-www-form-urlencoded",
          data: {
              volunteer: volunteer,
              reviewer: reviewer,
              legs: legs,
              counterpartApproved: counterpartApproved,
          },
          dataType: 'json',
          url: url,
          success: function(response) {
              if (response && response.redirect) {
                  // response.redirect contains the string URL to redirect to
                  window.location.href = response.redirect;
              }
          }
      });
  });
});
