var socket = io.connect(); // Create connection to node.js socket

$(document).ready(function() { // Start when document is ready

  $('.boseButton').click(function(){ // Handle Event of Bose Preset Button click
    var message = this.value;
    var btnValue = $(this).html();
    $(this).html('<span class="glyphicon glyphicon-hourglass" aria-hidden="true"></span>');
    socket.emit('boseButtonPressed', Array(message, [this.id, btnValue])); // Send event to Server
  });

  socket.on('boseButtonPressedStatus', function(data) { // Listen for event "btnActionPressedStatus"
    if(data[1] == "success") {
      $('#'+data[0][0]).html(data[0][1]);
    }
  });

  socket.on('boseVolumeUpdate', function(data) { // Listen for event "btnActionPressedStatus"
    if(data[1] !== "true") { // Not muted
      $('#boseVolume').html('Current Volume: '+data[0]);
    }else{
      $('#boseVolume').html('Current Volume: Muted');
    }
  });
});
