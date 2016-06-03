var socket = io.connect(); // Create connection to node.js socket

$(document).ready(function() { // Start when document is ready
  $(".btn").click(function(){
    $(this).button('loading'); // Change button Text to "Loading..."
    var btnData = JSON.parse($(this).val()); // Get the value-parameter of the button as JSON
    socket.emit('btnActionPressed', btnData); // Send button pressed event to node.js socket with button value (JSON)

    socket.on('btnActionPressedStatus', function(data) { // Listen for event "btnActionPressedStatus"
    console.log("I'm here!");
      console.log(data);
      var btn = $("#"+data._id+data.status); // Identify button by it's ID
      console.log(btn);
      btn.button('reset');
    });
  });

  socket.emit('boseWhatsPlaying', "hi!");
  socket.on('boseNowPlaying', function(data) { // Listen for event "btnActionPressedStatus"
  alert("here we go");
    var station = "Sender: "+data.nowPlaying.stationName;
    var art = data.nowPlaying.art._;
    var description = data.nowPlaying.description;
    // data.nowPlaying.art.$.IMAGE_PRESENT // Show if Imageexists or not
    var songInfo = station;
    songInfo += ' <img src="'+art+'" alt="'+station+' Logo" height="40">';
    songInfo += '<br /> Beschreibung: '+description;
    console.log(data);
    $("#boseplay").html(songInfo);
  });
});
