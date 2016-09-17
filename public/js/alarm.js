var socket = io.connect(); // Create connection to node.js socket
var activeBoseSystems = Array();

$(document).ready(function() { // Start when document is ready
  socket.emit('boseGetDevices', ""); // Ask Server for all known devices

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
    var newAlarm = {};
    newAlarm.name = $('.alarmname').val();
    newAlarm.time = $('.alarmtime').val();
    var timeToSave = "";
    var myTime = $('.alarmtime').val().split(":");
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
    newAlarm.time = timeToSave;
    newAlarm.days = $('[name="alarmdays"]').val().split(",");
    newAlarm.preset = parseInt($('[name="alarmpresets"]').val())+1;
    newAlarm.active = $('.alarmactive').prop("checked");
    newAlarm.device = $('#alarmdevice').val();
    newAlarm.volume = $('#alarmvolume').val();
    socket.emit('alarmSaved', newAlarm); // Send event to Server
  });

  // -- Edit an alarm --
  $(document).on('click', '.editbtn', function(){
    var alarmID = $(this).data("id");
    var alarmRev = $(this).data("rev");
    sendNote("bla", "success");
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
    if(data.length > 0) {
      console.log(alarmSample0);
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
        var currentObject = activeBoseSystems.filterObjects("MAC", alarm.device);
        alarmSample.find('.alarmDevice').html(currentObject[0].name);
        alarmSample.find('.alarmPV').html("(Preset: "+alarm.preset+", Volume: "+alarm.volume+")");
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
        sendNote("Alarm activity could not be changed", "alert");
      }
    }else{
      sendNote("Alarm activity could not be changed", "alert");
    }
  });

  // -- Ask for active System (for Dropdown)--
  socket.on('boseGetDevicesUpdate', function(data) { // Listen for event "btnActionPressedStatus"
    activeBoseSystems = data;
    data.forEach(function(device) { // For each Group
      $('#alarmdevice').append( new Option(device.name,device.MAC) );
    });
    socket.emit('getAlarms', ""); // Ask for all alarms (in here: because we need the BOSE systems)
  });

  // -- React to a new saved alarm --
  socket.on('alarmSavedStatus', function(data) {
    socket.emit('getAlarms', ""); // Refresh all alarms
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
    console.log(data);
    $('#newalarm').html('Edit alarm: '+data.data.name);
    $('.alarmname').val(data.data.name);
    $('.alarmtime').val(data.data.time);

    $("#alarmdays").multiPicker({ selector : "li", prePopulate : data.data.days });
    console.warn(data.data.days);

    $("#alarmpresets").multiPicker({ selector : "li", prePopulate : (data.data.preset -1) });
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
});
