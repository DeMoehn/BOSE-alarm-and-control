var socket = io.connect(); // Create connection to node.js socket

$(document).ready(function() { // Start when document is ready
  socket.emit('alarmActiveState', ""); // Send event to Server
  socket.emit('boseGetSystem', ""); // Ask Server for current active System

  // - User actions -
  // -- Change alarm activity --
  $('.switch-input').click(function(){ // Handle Event of Bose Preset Button click
    if($(this).prop("id") != "alarmsactive") { // PLease don't care about the switch from the "create new"-Field!
      var id = $(this).prop("id");
      var value = $(this).prop("checked");
      socket.emit('alarmActiveChanged', Array(id, value)); // Send event to Server
    }
  });

  // -- Save a new alarm --
  $('#alarmsave').click(function(){ // Handle Event of creating a new alarm
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
    newAlarm.active = $('.alarmactive').prop("checked");
    newAlarm.device = $('#alarmdevice').val();
    alert(JSON.stringify(newAlarm));
    socket.emit('alarmSaved', newAlarm); // Send event to Server
  });

  // - Socket Responses -
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
    console.log(data); // TODO: Show popup or something if data has "updated" or "error"
  });

  // -- Ask for active System (for Dropdown)--
  socket.on('boseGetSystemUpdate', function(data) { // Listen for event "btnActionPressedStatus"
    if(data !== "none") { // There is a system
      if(activeBoseSystem !== "none") {
        $('#'+activeBoseSystem).css("background-color", "");
      }
      $('#'+data).css("background-color", "#449d48");
      activeBoseSystem = data; // Change to new Bose System
      socket.emit('boseWhatsPlaying', ""); // Ask Server for current Song
      socket.emit('boseGetVolume', ""); // Ask Server for current volume
    }else{
      $('.boseArt').html('No Bose System active');
    }
  });

  // -- React to a new saved alarm --
  socket.on('alarmSavedStatus', function(data) {
    $('.alarm tr:last').after('<tr><td width="300px"><div class="alarmInfo"><div class="alarmTime">'+data.time+' Uhr</div><div class="alarmName">'+data.name+' - </div><div class="alarmDays">'+data.days+'</div></div></td><td><div class="switch"><label class="switch"><input class="switch-input" type="checkbox" id="'+data._id+'" data-rev="'+data._rev+'" checked/><span class="switch-label" data-on="On" data-off="Off"></span><span class="switch-handle"></span></label></div></td></tr>');
  });

  // - Create Day Picker -
  $("#alarmdays").multiPicker({ selector : "li" });
});
