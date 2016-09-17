var socket = io.connect(); // Create connection to node.js socket

$(document).ready(function() { // Start when document is ready
  var activeBoseSystem = "none";
  var runningTimers = Array();
  socket.emit('boseGetSystem', ""); // Ask Server for current active System
  socket.emit('boseGetTimers', ""); // Ask Server for current active System

  // - User interaction -
  $('.boseSleeptimerBtn').click(function(){ // Handle Event of Bose System click
    if($(this).html() == "Save") { // Save sleeptimer
      var message = parseInt($('.boseSleeptimer option:selected').val())*60;
      socket.emit('boseSleeptimer', [message, activeBoseSystem]); // Send event to Server
    }else if($(this).html() == "Remove") {
      socket.emit('boseSleeptimerRemove', activeBoseSystem); // Send event to Server
    }
  });

  $('.boseDevice').click(function(){ // Handle Event of Bose System click
    var message = $(this).data('value');
    socket.emit('boseDeviceButtonPressed', message); // Send event to Server
    $('.boseDevicesDropdown option[value="'+message+'"]').prop('selected', true); // Select value in Mobile Fallback
  });

  $('.boseDevicesDropdown').change(function(){ // Mobile Fallback: Handle Event of Bose System in DropDown
    var message = $(this).val();
    socket.emit('boseDeviceButtonPressed', message); // Send event to Server
  });

  $('.boseButton').click(function(){ // Handle Event of Bose Preset Button click
    var message = this.value;
    var btnValue = $(this).html();
    $(this).html('<span class="glyphicon glyphicon-hourglass" aria-hidden="true"></span>');
    socket.emit('boseButtonPressed', Array(message, [this.id, btnValue])); // Send event to Server
  });

  // - Socket Responses -
  // Status from pressed Button
  socket.on('boseButtonPressedStatus', function(data) { // Listen for event "btnActionPressedStatus"
    if(data[1] == "success") {
      $('#'+data[0][0]).html(data[0][1]);
    }
  });

  // -- Ask for active System --
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

  // -- Volume change from BOSE --
  socket.on('boseVolumeUpdate', function(data) { // Listen for event "btnActionPressedStatus"
    if(data[1] !== "true") { // Not muted
      $('.boseVolume').html('Current Volume: '+data[0]);
    }else{
      $('.boseVolume').html('Current Volume: Muted');
    }
  });

  // -- Currently playing --
  socket.on('boseInfoUpdate', function(data) { // Listen for event "btnActionPressedStatus"
    $('.boseSleeptimerText').html("Timer: not set");
    $('.boseSleeptimer').attr('disabled',false);
    $('.boseSleeptimerBtn').html("Save");
    runningTimers.forEach(function(timer) { // Check for available timers
      if(activeBoseSystem == timer.device) {
        $('.boseSleeptimerText').html("Timer: "+timer.endTime);
        $('.boseSleeptimer').attr('disabled',true);
        $('.boseSleeptimerBtn').html("Remove");
      }
    });

    if(activeBoseSystem == data.device) {
      if(data.source == "SPOTIFY") { // It's playing Spotify
        $('.boseSongInfo').html(data.artist+' - <a href="'+data.trackID+'">'+data.track+"<a/><br />");
        $('.boseArt').html('<img class="boseArtContent" src="'+data.coverArt+'" width="300">');
      }else if(data.source == "INTERNET_RADIO"){ // It's playing radio
        $('.boseSongInfo').html(data.stationName+' ('+data.stationLocation+")"); // data.description
        $('.boseArt').html('<img class="boseArtContent" src="'+data.coverArt+'" width="300">');
      }else if(data.source == "STANDBY") {
        $('.boseSongInfo').html(""); // data.description
        $('.boseArt').html('System currently in Standby');
      }
      $('#'+data.device+' .boseDevicePower').html(data.source);
    }else{
      $('#'+data.device+' .boseDevicePower').html(data.source);
    }
  });

  socket.on('boseSleeptimerStatus', function(data) { // Listen for event "btnActionPressedStatus"
    if(data.ok) {
      sendNote("Timer created", "success");
      var newTimer = {}
      newTimer.device = data.data.device;
      newTimer.endTime = data.data.endTime;
      socket.emit('boseGetTimers', ""); // Ask Server for current active System
      if(activeBoseSystem == data.data.device) {
        $('.boseSleeptimerText').html("Timer: "+data.data.endTime);
      }
    }else{
      sendNote("Alarm problem: "+data.desc, "error");
    }
  });

  socket.on('boseGetTimersStatus', function(data) { // Listen for event "btnActionPressedStatus"
    if(data.ok) {
      runningTimers = data.data;
      runningTimers.forEach(function(timer) { // For each Group
        if(activeBoseSystem == timer.device) {
          $('.boseSleeptimerText').html("Timer: "+timer.endTime);
          $('.boseSleeptimer').attr('disabled',true);
          $('.boseSleeptimerBtn').html("Remove");
        }
      });
    }else{
      sendNote("Could not load running timers", "error");
    }
  });

  socket.on('boseSleeptimerRemoveStatus', function(data) { // Listen for event "btnActionPressedStatus"
    if(data.ok) {
      if(activeBoseSystem == data.device) {
        $('.boseSleeptimerText').html("Timer: not set");
        $('.boseSleeptimer').attr('disabled',false);
        $('.boseSleeptimerBtn').html("Save");
      }
      sendNote("Timer successfully removed", "success");
    }else{
      sendNote(data.desc, "error");
    }
  });

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
