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
});
