var socket = io.connect(); // Create connection to node.js socket

$(document).ready(function() { // Start when document is ready

  // -- Create a new Object --

  // --- Handle Category Dropdown ---
  $("#dropdown_selectcategory").on("click", "li a", function(event){
    $("#btn_selectcategory").html($(this).text() + ' <span class="caret"></span>');
    $("#btn_selectcategory").val($(this).data('id'));
  });

  // --- Handle Object Command Types ---
  $("#dropdown_commandtype").on("click", "li a", function(event){
    $("#btn_commandtype").html($(this).text() + ' <span class="caret"></span>');
    $("#btn_commandtype").val($(this).data('value'));
    $("#input_command").prop("disabled",false);
  });

  // --- Save the new Object ---
  $("#btn_createobject").click(function(){
    var newObject = { "type": "button",
                                "groupid": $("#btn_selectcategory").val(),
                                "commandtype": $("#btn_commandtype").val(),
                                "code": $("#input_command").val(),
                                "name": $("#input_objectname").val() };

    // Save new Object
    $("#btn_createobject").button('loading...'); // Change button Text to "Loading..."
    socket.emit('btnObjectSave', newObject); // Send save request to Server

    socket.on('btnObjectSaveStatus',function(data) { // Listen for a Response from the Server
      $("#btn_createobject").button('Create Object');
      if(data.ok === true) {
        $("#alert_status").html("Object successfully created");
      }else{
        $("#alert_status").html("Object was not created");
      }
    });
  });

  // -- Create a new Category --

  // --- Open Add Category Interface ---
  $("#addcategory").hide();
  $("#btn_addcategory").click(function(){
    $("#addcategory").show();
    $("#btn_selectcategory").prop("disabled",true);
    $("#btn_addcategory").prop("disabled",true);
    $("#input_objectname").prop("disabled",true);
    $("#btn_commandtype").prop("disabled",true);
    $("#input_command").prop("disabled",true);
    $("#btn_createobject").prop("disabled",true);
  });

  // --- Cancel/Close Add Category Interface ---
  $("#btn_cancelcategory").click(function(){
    $("#addcategory").hide();
    $("#btn_selectcategory").prop("disabled",false);
    $("#btn_addcategory").prop("disabled",false);
    $("#input_objectname").prop("disabled",false);
    $("#btn_commandtype").prop("disabled",false);
    $("#input_command").prop("disabled",false);
    $("#btn_createobject").prop("disabled",false);
  });

  /// --- Save New Category ---
  $("#btn_savecategory").click(function(){
      var newCategory = { "type": "group",
                                      "name": $("#input_category").val() };

      // Save category
      $("#btn_savecategory").button('loading...'); // Change button Text to "Loading..."
      socket.emit('btnCategorySave', newCategory); // Send save request to Server

      socket.on('btnCategorySaveStatus',function(data) { // Listen for a Response from the Server
        $("#btn_savecategory").button('Save');
        if(data.ok === true) {
          $("#alert_status").html("Category successfully created");
          $("#dropdown_selectcategory").append('<li><a href="#" data-id="'+data.id+'">'+newCategory.name+'</a></li>'); // Add new Category to Dropdown
        }else{
          $("#alert_status").html("Category was not created");
        }

        $("#btn_cancelcategory").click(); // Enable all buttons
        $("#input_category").val(""); // Delete Category name
      });
  });
});
