$(document).ready(function() { // Start when document is ready
  var currentLocation = window.location.pathname;
  $('.navbtn a[href="'+currentLocation+'"]').parent().toggleClass('navactive');

  // Prevent iOS opening a Safari Window
  var a=document.getElementsByTagName("a");
  for(var i=0;i<a.length;i++)
  {
      a[i].onclick=function() {
          window.location=this.getAttribute("href");
          return false
      }
  }
});
