$(document).ready(function() { // Start when document is ready
  // - Toggle between adding and removing the "responsive" class to topnav when the user clicks on the icon -
  $('#hiddenNav').click( function(e) {
    e.preventDefault();
    var x = document.getElementById("myTopnav");
    if (x.className === "topnav") {
        x.className += " responsive";
    } else {
        x.className = "topnav";
    }
    return false;
  } );
});
