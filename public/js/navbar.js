$(document).ready(function() { // Start when document is ready
  var currentLocation = window.location.pathname;
  $('.navbtn a[href="'+currentLocation+'"]').parent().toggleClass('navactive');
});
