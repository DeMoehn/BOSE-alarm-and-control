var socket = io.connect(); // Create connection to node.js socket
var activeBoseSystems = Array();

$(document).ready(function() { // Start when document is ready
  // - Helper functions -
  // -- Resets the form fields --
  function resetForms() {
    $('#newalarm').html('Create new Alarm'); // Change heading
    $('.alarmname').val(""); // Name
    $('.alarmtime').val(""); // Time
    unselect('alarmdays'); // Days
    unselect('alarmpresets'); // Preset
    $('.alarmvolume').val(20); // Volume
    $('#alarmvolumetext').html(20);
    $('#alarmsactive').prop('checked', true); // Active
    $('#alarmdevice option:first').prop('selected', true); // Device
    $('#alarmsave').html("Save");
    $('#canceledit').hide();
    $('#alarmdata').data('data', {});
  }

  // -- Helper to unselect all options in a list --
  function unselect(list) {
    $('input[name='+list+']').val('');
    $("#"+list).children().removeClass('active');
  }

  // -- Helper to select options in a list --
  function select(list, elements) {
    $("#"+list+" li").each(function( index ) {
      if($.inArray( index.toString(), elements ) >= 0) {
        //$( this ).addClass('active');
        $( this ).click();
      }
    });
  }

  // -- Helper to transform time from e.g. 7:0 to 07:00 --
  function transformTime(time, option) {
    var myTime = time.split(":");
    if(option == "add") {
      if(myTime[0].length == 2) {
        if(myTime[0][0] <= 0) {
          myTime[0] = "0"+myTime[0];
        }
      }else{
        myTime[0] = "0"+myTime[0];
      }
      if(myTime[1].length == 2) {
        if(myTime[1][0] <= 0) {
          myTime[1] = "0"+myTime[1];
        }
      }else{
        myTime[1] = "0"+myTime[1];
      }
      return myTime[0]+":"+myTime[1];
    }else{
      if(myTime[0][0] == 0) { // Change the format to strip 0
        timeToSave = myTime[0][1];
      }else{
        timeToSave = myTime[0];
      }
      if(myTime[1][0] == 0) {
        timeToSave += ":"+myTime[1][1];
      }else{
        timeToSave += ":"+myTime[1];
      }
      return timeToSave;
    }
  }

  // - User actions -
  // -- Volume Slider --
  $(document).on('input', '#alarmvolume', function(){ // Handle Event of Bose Preset Button click
    $('#alarmvolumetext').html($(this).val());
  });

  // -- Change alarm activity --
  $(document).on('click', '.switch-input', function(){ // Handle Event of Bose Preset Button click
    if($(this).prop("id") != "alarmsactive") { // PLease don't care about the switch from the "create new"-Field!
      var id = $(this).prop("id");
      var value = $(this).prop("checked");
      socket.emit('alarmActiveChanged', Array(id, value)); // Send event to Server
    }
  });

  // -- Save a new alarm --
  $(document).on('click', '#alarmsave', function(){
    var timeRegExp = new RegExp("^([0-1][0-9]|2[0-3]):([0-5][0-9])$");

    var myAlarm = $('#alarmdata').data('data'); // Either {} ot the data from the object to edit
    myAlarm.name = $('.alarmname').val(); // Name

    if(!timeRegExp.test($('.alarmtime').val())) {
      sendNote("Time must be in the Format HH:MM", "error");
      return;
    }
    if(myAlarm.name === "" || myAlarm.name == "" || myAlarm.name === undefined) {
      sendNote("Name must be set", "error");
      return;
    }

    myAlarm.time = transformTime($('.alarmtime').val(), "strip"); // Removes the 0s
    myAlarm.days = $('[name="alarmdays"]').val().split(",");
    myAlarm.preset = parseInt($('[name="alarmpresets"]').val())+1;
    myAlarm.active = $('.alarmactive').prop("checked");
    myAlarm.device = $('#alarmdevice').val();
    myAlarm.volume = $('#alarmvolume').val();

    if($(this).html() == "Save") {
      socket.emit('alarmSaved', myAlarm); // Send event to Server
    }else{
      socket.emit('alarmEdited', myAlarm); // Send event to Server
    }
  });

  // -- Cancel edit button --
  $(document).on('click', '#canceledit', function(){
    resetForms();
  });

  // -- Edit an alarm --
  $(document).on('click', '.editbtn', function(){
    var alarmID = $(this).data("id");
    var alarmRev = $(this).data("rev");
    socket.emit('alarmEdit', Array(alarmID, alarmRev)); // Send event to Server
  });

  // -- Delete an alarm --
  $(document).on('click', '.deletebtn', function(){
    var alarmID = $(this).data("id");
    var alarmRev = $(this).data("rev");
    socket.emit('alarmDelete', Array(alarmID, alarmRev)); // Send event to Server
  });

  // - Socket Responses -
  // -- Get and display all alarms --
  var alarmSample0 = $('.alarm .eachAlarm').first().clone(); // Clones the first <tr>
  socket.on('getAlarmsStatus', function(data) {
    $('.alarm').html("");
    if(data.hasOwnProperty('error')) {
      sendNote(data.desc, "error");
    }
    console.log(data);
    if(data.length > 0) {
      data.forEach(function(alarm) { // For each Group
        var alarmSample = alarmSample0.clone();
        alarmSample.attr('id', "alarm_"+alarm._id);
        alarmSample.css('display', "block");
        alarmSample.find('.alarmTime').html(alarm.time+" Uhr"); // Makes changes on this element
        alarmSample.find('.alarmName').html(alarm.name);
        alarmSample.find('.alarmDays').html(alarm.days.join(', '));
        Array.prototype.filterObjects = function(key, value) {
            return this.filter(function(x) { return x[key] === value; })
        }
        if(activeBoseSystems.length > 0 && alarm.device !== "None") {
          var currentObject = activeBoseSystems.filterObjects("MAC", alarm.device);
          alarmSample.find('.alarmDevice').html(currentObject[0].name);
        }else{
          alarmSample.find('.alarmDevice').html("Not found");
        }
        if(alarm.preset == 7) {
          alarmSample.find('.alarmPV').html("(Preset: power off)");
        }else{
          alarmSample.find('.alarmPV').html("(Preset: "+alarm.preset+", Volume: "+alarm.volume+")");
        }
        alarmSample.find('.switch-input').attr('id', alarm._id);
        alarmSample.find('.switch-input').attr('data-rev', alarm._rev);
        alarmSample.find('.editbtn').attr('data-id', alarm._id);
        alarmSample.find('.editbtn').attr('data-rev', alarm._rev);
        alarmSample.find('.deletebtn').attr('data-id', alarm._id);
        alarmSample.find('.deletebtn').attr('data-rev', alarm._rev);
        if(alarm.active === "true") {
          alarmSample.find('.switch-input').prop('checked', true);
        }else{
          alarmSample.find('.switch-input').prop('checked', false);
        }
        $('.alarm').append(alarmSample);
      });
    }else{
      $('.alarm').append('Currently no alarms set!'); // Show if no alarms are set
    }
  });

  // -- Status of alarm active  --
  socket.on('alarmActiveStateStatus', function(data) { // Listen for event "alarmActiveStateStatus"
    data.forEach(function(alarm) { // For each Group
      if(alarm.active === "true") {
        $('#'+alarm._id).prop('checked', true);
      }else{
        $('#'+alarm._id).prop('checked', false);
      }
    });
  });

  // -- Status from alarm activity change --
  socket.on('alarmActiveChangedStatus', function(data) { // Listen for event "alarmActiveChangedStatus"
    if(data.hasOwnProperty('resp')) { // Everything went ok
      if(data.resp.ok = true) {
        if(data.data.active === "true") {
          sendNote("Alarm '"+data.data.name+"' changed to: active", "success");
        }else{
          sendNote("Alarm '"+data.data.name+"' changed to: inactive", "success");
        }
      }else{
        sendNote(data.desc, "alert");
      }
    }else{
      sendNote(data.desc, "alert");
    }
  });

  // -- Ask for active System (for Dropdown)--
  socket.on('boseGetDevicesUpdate', function(data) { // Listen for event "btnActionPressedStatus"
    activeBoseSystems = data;
    if(data.hasOwnProperty('error')) {
      sendNote(data.desc, "error");
      $('#alarmdevice').append( new Option("None", "None") );
    }else{
      data.forEach(function(device) { // For each Group
        $('#alarmdevice').append( new Option(device.name,device.MAC) );
      });
    }
    socket.emit('getAlarms', ""); // Ask for all alarms (in here: because we need the BOSE systems)
  });

  // -- React to a new saved alarm --
  socket.on('alarmSavedStatus', function(data) {
    if(data.hasOwnProperty('ok')) { // Everything went ok
      resetForms();
      socket.emit('getAlarms', ""); // Refresh all alarms
      sendNote("Alarm: '"+data.data.name+"' created!", "success");
    }else{
      sendNote(data.desc, "alert");
    }
  });

  // -- React to a new saved alarm --
  socket.on('alarmEditedStatus', function(data) {
    if(data.hasOwnProperty('updated')) { // Everything went ok
      resetForms();
      socket.emit('getAlarms', ""); // Refresh all alarms

      sendNote("Alarm: '"+data.data.name+"' edited!", "success");
    }else{
      sendNote(data.desc, "error");
    }
  });

  // -- React to deleted alarm --
  socket.on('alarmDeleteStatus', function(data) {
    if(data.success) {
      sendNote("Alarm: "+data.name+" deleted!", "success");
      $('#alarm_'+data.id).remove();
    }else{
      sendNote("Couldn't delete alarm: "+data.name, "error");
    }
  });

  // -- React to edit request alarm --
  socket.on('alarmEditStatus', function(data) {
    $('#newalarm').html('Edit alarm: '+data.data.name); // Change heading
    $('.alarmname').val(data.data.name); // Name
    $('.alarmtime').val(transformTime(data.data.time, "add")); // Time
    unselect('alarmdays'); // Days
    select('alarmdays', data.data.days);
    unselect('alarmpresets'); // Preset
    select('alarmpresets', [(data.data.preset-1).toString()]);
    $('.alarmvolume').val(data.data.volume); // Volume
    $('#alarmvolumetext').html(data.data.volume);
    var myActive = (data.data.active === "true"); // Converts String to Bool
    $('#alarmsactive').prop('checked', myActive); // Active
    $('#alarmdevice option[value="'+data.data.device+'"]').prop('selected', true); // Device
    $('#alarmsave').html("Edit");
    $('#canceledit').show();
    $('#alarmdata').data('data', data.data);

    sendNote("Alarm ready to edit", "alert");
  });

  // - Create Day Picker -
  $("#alarmdays").multiPicker({ selector : "li" });
  $("#alarmpresets").multiPicker({ selector : "li", isSingle: true });

  // - Notifications -
  $.noty.defaults = {
    layout: 'topRight',
    theme: 'relax', // or 'relax'
    dismissQueue: true, // If you want to use queue feature set this true
    template: '<div class="noty_message"><span class="noty_text"></span><div class="noty_close"></div></div>',
    animation: {
        open: {height: 'toggle'}, // or Animate.css class names like: 'animated bounceInLeft'
        close: {height: 'toggle'}, // or Animate.css class names like: 'animated bounceOutLeft'
        easing: 'swing',
        speed: 300 // opening & closing animation speed
    },
    timeout: 2000, // delay for closing event. Set false for sticky notifications
    force: false, // adds notification to the beginning of queue when set to true
    modal: false,
    maxVisible: 8, // you can set max visible notification for dismissQueue true option,
    killer: false, // for close all notifications before show
    closeWith: ['click'], // ['click', 'button', 'hover', 'backdrop'] // backdrop click will close all notifications
    callback: {
        onShow: function() {},
        afterShow: function() {},
        onClose: function() {},
        afterClose: function() {},
        onCloseClick: function() {},
    },
    buttons: false // an array of buttons
  };

  function sendNote(nText, nType) {
    var n = noty({
        text: nText,
        type: nType, // alert - success - error - warning - information - confirmation
    });
  }

  // - on Startup -
  socket.emit('boseGetDevices', ""); // Ask Server for all known devices
  $('#canceledit').hide(); // Hide edit button
  resetForms(); // Set all forms to standard
});
