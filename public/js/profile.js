/* globals window */
/* globals confirm */
/* globals userToShow */

$(function() {
    'use strict';

    function getPhoneNumbers() {
      var phones = [];
      var inputs = $('#phoneNumbers .phoneNumber');
      inputs.each(function(index) {
        var phone = inputs.get(index);
        if ($(phone).intlTelInput("isValidNumber")) {
          var number = $(phone).intlTelInput('getNumber');
          phones.push(number);
        }
      });
      return phones;
    }

    function ifPhonesChanged() {
      var newNumbers = getPhoneNumbers();
      if (userToShow.phones === undefined) {
        return newNumbers.length > 0;
      }
      for(var i = 0; i < newNumbers.length; i++) {
        if(userToShow.phones.indexOf(newNumbers[i]) == -1) {
          return true;
        }
      }
      for(i = 0; i < userToShow.phones.length; i++) {
        if(newNumbers.indexOf(userToShow.phones[i]) == -1) {
          return true;
        }
      }
      return false;
    }

    var $selectCountry = $('select#country').selectize({
        valueField: 'countryCode',
        labelField: 'country',
        searchField: ['country', 'countryCode'],
        sortField: 'country',
    })[0];

    var $selectAccess = $('select#access').selectize({
        valueField: 'accessLevel',
        labelField: 'access',
        searchField: ['access', 'accessLevel'],
        sortField: 'access',
        options: [
          { access: 'Volunteer', accessLevel: 0 },
          { access: 'Staff', accessLevel: 1 },
          { access: 'Administrator', accessLevel: 2 },
        ],
        items: [
          $('select#access').attr('value')
        ]
    })[0];

    // Load the JSON file of the countries
    $.ajax({
        method: "GET",
        url: "/data/countryList.json",
        datatype: "json",
        success: function(json) {
            var arrCountries = [];
            for(var key in json) {
                arrCountries.push({ "country": json[key], "countryCode": key });
            }

            $selectCountry.selectize.addOption(arrCountries);
            $selectCountry.selectize.refreshOptions(false);

            $selectCountry.selectize.setValue($('select#country').attr('value'));
        }
    });

    function defaultData($obj) { return $obj.data('default'); }

    function ifChanged($obj) {
        return ($obj.val().toString() === defaultData($obj).toString() ? undefined : $obj.val());
    }

    function ifSelectizeChanged($obj) {
        var $select = $obj.selectize()[0].selectize;
        return ($select.getValue() === defaultData($obj).toString() ?
            undefined :
            $select.getValue());
    }

    function changedProfileData() {
        var data = {};
        if(ifChanged($('input#name'))) { data.name = ifChanged($('input#name')); }
        if(ifChanged($('input#email'))) { data.email = ifChanged($('input#email')); }
        if(ifPhonesChanged()) {
          var numbers = getPhoneNumbers();
          // yuck, we may want to return to JSON
          // see: https://bugs.jquery.com/ticket/6481
          if(numbers.length === 0) {
            data.phones = "empty";
          } else {
            data.phones = numbers;
          }
        }
        if(ifChanged($('select#country'))) { data.countryCode = ifSelectizeChanged($('select#country')); }
        if(ifChanged($('select#access'))) { data.access = ifSelectizeChanged($('select#access')); }
        return data;
    }

    function hasProfileDataChanged(changedData) {
        return (
            changedData.name !== undefined ||
            changedData.email !== undefined ||
            changedData.phones !== undefined ||
            changedData.countryCode !== undefined ||
            changedData.access !== undefined);
    }

    function toggleDisabledSubmissionButton() {
        var changedData = changedProfileData();
        if (hasProfileDataChanged(changedData)) {
            $('form button[type=submit]').prop('disabled', false);
        } else {
            $('form button[type=submit]').prop('disabled', true);
        }
    }

    function handlePhoneNumberCount() {
      if($('#phoneNumbers .phoneNumberWrapper').size() == 1 &&
        $('#phoneNumbers .phoneNumber').first().intlTelInput("getNumber") === '') {
        $('#phoneNumbers .removePhone').prop('disabled', true);
      } else {
        $('#phoneNumbers .removePhone').prop('disabled', false);
      }
    }

    function addPhoneInput(phoneNumber) {
      // input.form-control#phone(type='tel', value=(userToShow.phone ? userToShow.phone : ''), data-default=(userToShow.phone ? userToShow.phone : ''), placeholder='(123) 456 7890')
      $('#phoneNumbers').append('<div class="phoneNumberWrapper"><div class="col-xs-9 phoneDiv"><input class="form-control phoneNumber" type="tel" placeholder="(123) 456 7890" ' + ($('#disableProfile').val() === 'true' ? 'disabled' : '') + '></div><div class="col-xs-3 deletePhoneDiv"><button class="btn-override btn btn-danger removePhone" type="button">Delete</button></div></div>');
      var newPhoneInput = $('#phoneNumbers').find('.phoneNumber').last();
      newPhoneInput.intlTelInput({
          utilsScript: '/js/utils.js',
      });
      if (phoneNumber !== undefined) {
        $(newPhoneInput).intlTelInput('setNumber', phoneNumber);
      }
      handlePhoneNumberCount();
      $('.removePhone').off('click');
      $('.removePhone').on('click', function(event) {
        var phoneNumberIndex = $('#phoneNumbers .removePhone').index($(this));
        if($('#phoneNumbers .phoneNumberWrapper').size() == 1) {
          $('#phoneNumbers .phoneNumber').first().intlTelInput('setNumber', '');
        } else {
          $('#phoneNumbers .phoneNumberWrapper').get(phoneNumberIndex).remove();
        }
        handlePhoneNumberCount();
        toggleDisabledSubmissionButton();
        event.preventDefault();
      });
      $(newPhoneInput).off('countrychange');
      $(newPhoneInput).on('countrychange', toggleDisabledSubmissionButton);
      $(newPhoneInput).off('keyup');
      $(newPhoneInput).on('keyup', function() {
        handlePhoneNumberCount();
        toggleDisabledSubmissionButton();
      });
    }

    $('#addPhone').on('click', function(event) {
      addPhoneInput();
      event.preventDefault();
    });

    // Guarantee that there is at least one phone number field
    var firstPhone;
    if (userToShow.phones && userToShow.phones.length > 0) {
      firstPhone = userToShow.phones[0];
    }
    addPhoneInput(firstPhone);

    // If the user has more phone numbers, add them
    if (userToShow.phones && userToShow.phones.length > 1) {
      for(var i = 1; i < userToShow.phones.length; i++) {
        addPhoneInput(userToShow.phones[i]);
      }
    }

    // Events for when the form is changed
    $('form#profile input').on('keyup', toggleDisabledSubmissionButton);
    $selectCountry.selectize.on('change', toggleDisabledSubmissionButton);
    $selectAccess.selectize.on('change', toggleDisabledSubmissionButton);

    // Event for when the form is submitted
    $('form#profile').on('submit', function(e) {
      e.preventDefault();
      var changedData = changedProfileData();
      if(hasProfileDataChanged(changedData)) {
          $.ajax({
              method: 'POST',
              url: '/api/users/' + $('input#userId').val(),
              contentType: "application/x-www-form-urlencoded",
              data: changedData,
              success: function(response) {
                  if (response && response.redirect) {
                      window.location.href = response.redirect;
                  }
              }
          });
        }
    });

    $('#deleteAccount').on('click', function(e) {
      e.preventDefault();
      var id = $('#userId').val();
      var loggedInUserId = $('#loggedInUserId').val();
      var name = $('#headerName').text();
      var text;
      if(id === loggedInUserId) {
        text = 'Are you sure you want to delete your own account?';
      } else {
        text = 'Are you sure that you want to delete ' + name + '\'s account?';
      }
      if(confirm(text)) {
  			$.ajax({
  				method: 'DELETE',
          contentType: "application/x-www-form-urlencoded",
  				url: '/api/users/' + id,
  				success: function(response) {
  					if (response && response.redirect) {
              window.location.href = response.redirect;
  					}
  				}
  			});
  		}
    });
});
