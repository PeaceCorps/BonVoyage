/* jshint multistr: true */
/* globals moment */
/* globals DateOnly */
/* globals console */
/* globals window */
/* globals getWarnings */
/* globals submissionData */
/* globals PICKADATE_DISPLAY_FORMAT */

$(function() {
  "use strict";
  var count = 0;
  var arrCountries = [];

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
                  <span><span class='glyphicon glyphicon-exclamation-sign' aria-hidden='true'></span><b>" + warning.source + " - " + warning.type + ": </b> " + warning.textOverview + " <b><a href='" + warning.link + "'>More Information</a></b></span> \
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
  }

  function addLeg(leg) {
      count++;
      var m = new moment();
      m.add(1, 'month');
      var default_start = new DateOnly(m);
      m.add(4, 'days');
      var default_end = new DateOnly(m);
      console.log(default_start);
      console.log(default_end);
      var html =
      "<div class='leg shadow-box'> \
          <h2> Trip Leg #" + count + " </h2> \
          <label class='info'>Date leaving <span class='required'>*<span></label> \
          <input class='form-control datepicker date-leaving' type='text' placeholder='Jan 1, 2000', value='" + (leg && leg.start_date ? leg.start_date : default_start.toString()) + "'> \
          <label class='info'>Date returning <span class='required'>*<span></label> \
          <input class='form-control datepicker date-returning' type='text' placeholder='Dec 31, 2000', value='" + (leg && leg.end_date ? leg.end_date : default_end.toString()) + "'> \
          <label class='info'>City <span class='required'>*<span></label> \
          <input class='form-control city' type='text' placeholder='Chicago' value='" + (leg && leg.city ? leg.city : '') + "'></input> \
          <label class='info'>Country <span class='required'>*<span></label> \
          <select class='form-control select-country' placeholder='United States'></select> \
          <div class='warnings'></div> \
          <label class='info'>Travel contact</label> \
          <input class='form-control contact' type='text' placeholder='+1 123-456-7890  and/or  johndoe@peacecorps.gov' value='" + (leg && leg.contact ? leg.contact : '') + "'></input> \
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
      var data = {
          start_date: (start ? (new DateOnly(start).toString()) : undefined),
          end_date: (end ? (new DateOnly(end).toString()) : undefined),
          city: $(leg).find('.city').val(),
          country: $(leg).find('.selectized').selectize()[0].selectize.getValue(),
          hotel: $(leg).find('.hotel').val(),
          contact: $(leg).find('.contact').val(),
          companions: $(leg).find('.companions').val(),
          description: $(leg).find('.description').val()
      };
      return data;
  }

  function isSubmitAsOtherUserShowing() {
      return $('.selectRequestee').length > 0;
  }

  function submissionDataExists() {
      return !$.isEmptyObject(submissionData);
  }
  $('.select-country').selectize();
  var $select_requestee = $('.selectRequestee').selectize({
      valueField: '_id',
      labelField: 'name',
      searchField: ['name'],
      sortField: 'name'
  });


  if (isSubmitAsOtherUserShowing()) {
      $.ajax({
          method: "GET",
          url: "/api/users?maxAccess=VOLUNTEER",
          dataType: "json",
          success: function(json) {
              console.log(json);
              $select_requestee[0].selectize.addOption(json);
              $select_requestee[0].selectize.refreshOptions(false);
              if(submissionDataExists()) {
                  // A failure just occurred during submission: we need to replace the previously submitted data
                  if (isSubmitAsOtherUserShowing() && submissionData.email !== undefined) {
                      $select_requestee[0].selectize.setValue(submissionData._id);
                  }
              }
          }
      });
  }

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
                  console.log($select[i]);
                  $select[i].selectize.setValue(submissionData.legs[i].country);
              }
          }
      }
  });


  if(submissionDataExists()) {
      // A failure just occurred during submission: we need to replace the previously submitted data
      // Create all of the legs, and fill what data can be filled without the above AJAX calls finishing (countries, submit as other user)
      console.log(submissionData);
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
      var userId;
      if (isSubmitAsOtherUserShowing()) {
          userId = $select_requestee[0].selectize.getValue();
      }
      var counterpartApproved = $('#approvalCheckbox').is(':checked');
      
      $.ajax({
          method: "POST",
          contentType: "application/x-www-form-urlencoded",
          data: {
              userId: userId,
              legs: legs,
              counterpartApproved: counterpartApproved,
          },
          dataType: 'json',
          url: '/api/requests',
          success: function(response) {
              if (response && response.redirect) {
                  // response.redirect contains the string URL to redirect to
                  window.location.href = response.redirect;
              }
          }
      });
  });
});
