var socket = io.connect(); // Create connection to node.js socket

$(document).ready(function() { // Start when document is ready
  socket.on('btnStatus',function(data) { // Listen for event "btnStatus"
    var btnData = JSON.parse(data);
    var btn = $("#"+btnData.id+btnData.status);
    
    btn.button('reset');

    btn.val(data);
  });

  $(".btn").click(function(){
    var btn = $(this);
    btn.button('loading'); // Change button Text to "Loading..."
    var btnData = JSON.parse(btn.val()); // Get the value-parameter of the button as JSON

    socket.emit('btnPressed', JSON.stringify(btnData)); // Send button pressed event to node.js socket with button value (JSON)
  });
});
