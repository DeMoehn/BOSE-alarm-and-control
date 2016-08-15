var socket = io.connect(); // Create connection to node.js socket

$(document).ready(function() { // Start when document is ready
  socket.emit('boseWhatsPlaying', ""); // Send event to Server
  socket.emit('boseGetVolume', ""); // Send event to Server
  socket.emit('boseGetSystems', ""); // Send event to Server

  // User interaction
  $('.boseButton').click(function(){ // Handle Event of Bose Preset Button click
    var message = this.value;
    var btnValue = $(this).html();
    $(this).html('<span class="glyphicon glyphicon-hourglass" aria-hidden="true"></span>');
    socket.emit('boseButtonPressed', Array(message, [this.id, btnValue])); // Send event to Server
  });

  // Status from pressed Button
  socket.on('boseButtonPressedStatus', function(data) { // Listen for event "btnActionPressedStatus"
    if(data[1] == "success") {
      $('#'+data[0][0]).html(data[0][1]);
    }
  });

  // Volume change from BOSE
  socket.on('boseVolumeUpdate', function(data) { // Listen for event "btnActionPressedStatus"
    if(data[1] !== "true") { // Not muted
      $('.boseVolume').html('Current Volume: '+data[0]);
    }else{
      $('.boseVolume').html('Current Volume: Muted');
    }
  });

  socket.on('boseInfoUpdate', function(data) { // Listen for event "btnActionPressedStatus"
  console.log(data);
    if(data.source == "SPOTIFY") { // It's playing Spotify
      $('.boseSongInfo').html(data.artist+' - <a href="'+data.trackID+'">'+data.track+"<a/><br />"+data.album);
      $('.boseArt').html('<img src="'+data.coverArt+'" width="300">');
    }else{ // It's playing radio


        $('.boseSongInfo').html(data.stationName+' ('+data.stationLocation+")"); // data.description
        $('.boseArt').html('<img src="'+data.coverArt+'" width="300">');
    }
  });

  socket.on('boseGetSystemsStatus', function(data) { // Listen for event "btnActionPressedStatus"
    console.log(data);
    data.forEach(function(system) { // For each Group
      console.log(system);
      var content = $('.boseSystems').html();
      var systemC = '<div class="boseDevice"><img src="img/bose_soundtouch10.png" height="80">';
      systemC += system.name+'</div>';
      $('.boseSystems').html(content+systemC);
    });
  });
});
