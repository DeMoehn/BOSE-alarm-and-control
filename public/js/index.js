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
