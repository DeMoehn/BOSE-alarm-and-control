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

  // socket.emit('boseWhatsPlaying', "hi!");
  // socket.on('boseNowPlaying', function(data) { // Listen for event "btnActionPressedStatus"
  //   alert("here we go");
  //   var songInfo = "";
  //
  //   if(data.nowPlaying.$.source == 'INTERNET_RADIO') {
  //     var station = "Sender: "+data.nowPlaying.stationName;
  //     var art = data.nowPlaying.art._;
  //     var description = data.nowPlaying.description; // data.nowPlaying.art.$.IMAGE_PRESENT // Show if Imageexists or not
  //     songInfo = station;
  //     songInfo += ' <img src="'+art+'" alt="'+station+' Logo" height="40">';
  //     songInfo += '<br /> Beschreibung: '+description;
  //   }else if(data.nowPlaying.$.source == 'SPOTIFY') {
  //     var artist = data.nowPlaying.artist;
  //     var track = data.nowPlaying.track;
  //     var trackID = data.nowPlaying.trackID;
  //     var album = data.nowPlaying.album;
  //     var art = data.nowPlaying.art._;
  //     songInfo = '<table><tr><td>'+artist +" - "+'<a href="'+trackID+'">'+track+'</a><br />'+album+'</td><td width="10px"</td><td><img src="'+art+'" alt="'+track+'" height="100"></td></tr></table>';
  //     songInfo = '<button id="nextSong" type="button"> <span style="padding-right:3px;"><<</span></button>';
  //   }
  //
  //   console.log(data);
  //   $("#boseplay").html(songInfo);
  // });

  var connection;
  var url = "192.168.0.13";
  var wsport = "8080";
  function listen() {
    connection = new WebSocket('ws://' + url + ':' + wsport, "gabbo");
    connection.onopen = function() { $("#connstatus").text("Connection open. "); };
    connection.onmessage = function(e) {
      $("#messages").innerHTML += "<br /><br />";
      $("#messages").innerText += e.data;
    };
    connection.onclose = function() { $("#connstatus").append("Connection closed. "); }
    connection.onerror = function() {
      $("#connstatus").text("Connection error. ");
      setTimeout(listen, 1000);
    };
  }
});
