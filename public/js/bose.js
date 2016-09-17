var socket = io.connect(); // Create connection to node.js socket

$(document).ready(function() { // Start when document is ready
  var activeBoseSystem = "none";
  socket.emit('boseGetSystem', ""); // Ask Server for current active System

  // - User interaction -
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
  });

});
