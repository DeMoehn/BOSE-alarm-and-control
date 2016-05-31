// jshint esversion: 6
// ---------------------------------
// - Require & Variables Setup -
// --------------------------------

// - Webserver & Socket IO -
var express = require('express'); // Web - Framework
var doT = require('express-dot'); // Templating
var compression = require('compression'); // gzip/deflate outgoing responses
var app = express();
var server = require('http').Server(app); // Http Server
var io = require('socket.io')(server); // IO Socket

// - Shell Scripts -
var path = require('path');
var sys = require('sys');
var exec = require('child_process').exec;

// - Database -
var nano = require('nano')('https://demoehn:a11HQSM54!!@demoehn.cloudant.com'); // Connect to CouchDB
var db = nano.use('homeautomation'); // Connect to Database

// - Define Variables -
var cmd = 'pilight-send -p'; //Command to send with "pilight" and -p for Protocol (Rest comes from DB)
var files = __dirname + '/public/';

// Available Buttons
var myGroups = Array();
var myObjects = Array();
var objectsScanned = false;


// ------------------
// - Server Setup -
// ------------------

// - Listen for paths -
app.set('views', __dirname+'/views');
app.set('view engine', 'dot'); // Use dot Templating
app.engine('dot', doT.__express); // Use dot Templating
app.use(compression()); // Use compression
app.use(express.static(__dirname + '/public')); // Use Express.static middleware to servce static files

// - Home route -
app.get('/', homeRoute);
app.get('/home', homeRoute);
function homeRoute(req, res) {
  myGroups = []; // Reset variables if loaded again
  myObjects = [];
  objectsScanned = false;

  db.view('show', 'groups', function(err, groupBody) { // Read all Groups
    if (!err) {
      db.view('show', 'btns', function(err, objectBody) { // Read all Objects
        if (!err) {
          groupBody.rows.forEach(function(groupDoc) { // For each Group
            groupDoc.devices = Array(); // Store all objects here
            objectBody.rows.forEach(function(objectDoc) { // For each Object
              if(objectDoc.value.groupid == groupDoc.id) { // Does this object belong to the group?
                groupDoc.devices.push(objectDoc);
              }
              if(!objectsScanned) {
                myObjects.push(objectDoc.value);
              }
            });
            myGroups.push(groupDoc); // Save the group to an array
            objectsScanned = true; // Only save the objects once (not for every group)
          });

          res.render('index', {items: myGroups}); // Render and pass variables
        }
      });
    }
  });
}

// - Manage route -
app.get('/manage', manageRoute);
function manageRoute(req, res) {
  db.view('show', 'groups', function(err, body) {
    if (!err) {
      items = body.rows;
      res.render('manage', {items: items}); // Render and pass variables
    }
  });
}

// - Start Server -
server.listen(3000, function() { // Create Server on 3000
  console.log('listening on http://localhost:3000');
});


// ------------------------
// - General Functions -
// -----------------------

// - Send to Intertechno Device -
function sendToDev(obj, data) {
  var devcmd = obj.code;
  var stat = data.status;

  var send = "";

  send =  cmd+" "+devcmd;
  if(stat == 1) {
    send =  send + " -t";
  }else{
    send =  send + " -f";
  }

  console.log('Device - Command: '+send);

  exec(send+" && "+send+" && "+send, function (err, stdout, stderr) { // e.g. pilight-send -p kaku_switch -i 4762303 -u 0 -t
    if (err) {
      console.log('exec error: ' + err);
    }else{
      console.log(stdout);
      obj.status = stat;
      io.sockets.emit('btnActionPressedStatus', obj); // Respond with JSON Object of btnData
    }
  });
}

function sendToBose(obj, data) {
  var devcmd = obj.code;
  var stat = data.status;

  exec(devcmd, function (err, stdout, stderr) { // Exceute command
    if (err) {
      console.log('exec error: ' + err);
    }else{
      console.log(stdout);
    }
  });

  obj.status = stat;
  io.sockets.emit('btnActionPressedStatus', obj); // Respond with JSON Object of btnData
}


// ------------------------
// - Socket.io Settings -
// ------------------------

// - General Socket.io Connection -
io.on('connection', function(socket){
  console.log('a user connected');

  socket.on('disconnect', function(){
    console.log('user disconnected');
  });

  socket.on('btnActionPressed', actionButtonPressed);
  socket.on('btnCategorySave', createNewCategory);
  socket.on('btnObjectSave', createNewObject);
});


// - Socket Helper-Functions -

  // -- Handle Button Press --
  function actionButtonPressed(data, callback) {
    var currentObject = myObjects.find(x=> x._id === data.id); // Find Object where _id equals data.id

    if(typeof currentObject.commandtype === 'undefined') {
      sendToDev(currentObject, data);
    }else{
      if(currentObject.commandtype == "BOSE") {
        sendToBose(currentObject, data);
      }
    }
  }

  // -- Create a new Category --
  function createNewCategory(data, callback) {
    db.insert(data, function(err, body, header) { // Update button
      if (err) {
        console.log('[db.insert] ', err.message);
      }else{
        console.log('A new category was created: '+data.name);
        io.sockets.emit('btnCategorySaveStatus', body); // Respond with JSON Object of btnData
      }
    });
  }

  // -- Create a new Object --
  function createNewObject(data, callback) {
    db.insert(data, function(err, body, header) { // Update button
      if (err) {
        console.log('[db.insert] ', err.message);
      }else{
        console.log('A new object was created: '+data.name);
        io.sockets.emit('btnObjectSaveStatus', body); // Respond with JSON Object of btnData
        console.log(body);
      }
    });
  }
