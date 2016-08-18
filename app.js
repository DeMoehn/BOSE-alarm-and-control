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
var needle = require('needle'); // HTTP Handler
var parseString = require('xml2js').parseString; // Used to transform XML to JSON
var WebSocket = require('ws'); // To use WebSockets
var mdns = require('mdns'); // MDNS Tool to discover devices

// discover all available service types
var all_the_types = mdns.browseThemAll(); // all_the_types is just another browser...

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

// Other Variables
var myBoseDevices = Array();
var activeBoseSystem = {name: "none"};
var url = "192.168.0.135"; // TODO: change static url to dynamic activeBoseSystem
var alarmsArr = Array(); // Save all Alarms

// ------------------
// - Server Setup -
// ------------------

// - Listen for paths -
app.set('views', __dirname+'/views');
app.set('view engine', 'dot'); // Use dot Templating
app.engine('dot', doT.__express); // Use dot Templating
app.use(compression()); // Use compression
app.use(express.static(__dirname + '/public')); // Use Express.static middleware to servce static files

// - Routes -
app.get('/', homeRoute);
app.get('/home', homeRoute);
app.get('/manage', manageRoute);
app.get('/info', infoRoute);
app.get('/bose', boseRoute);
app.get('/alarm', alarmRoute);

// - Home route -
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
function manageRoute(req, res) {
  db.view('show', 'groups', function(err, body) {
    if (!err) {
      items = body.rows;
      res.render('manage', {items: items}); // Render and pass variables
    }
  });
}

// - Info route - TODO: Create Info file!
function infoRoute(req, res) {
      res.render('info', {}); // Render and pass variables
}

// - Bose Music route -
function boseRoute(req, res) {
  res.render('bose', {items: myBoseDevices}); // Render and pass variables
}

// - Alarm Route -
function alarmRoute(req, res) {
  loadAlarms();
  res.render('alarm', ""); // Render and pass variables
};

// - Start Server -
server.listen(3000, function() { // Create Server on 3000
  console.log('listening on http://localhost:3000');
});
// - Advertise a http server on port 3000 (via MDNS)-
var ad = mdns.createAdvertisement(mdns.tcp('http'), 4321);
ad.start();


// ------------------------
// - General Functions -
// -----------------------

// - Helpers for the routes -
function loadAlarms() {
  var sendUrl = "http://localhost:3333/api/timer";
  needle.get(sendUrl, function(error, response) {
    if (!error && response.statusCode == 200) {
      console.log(response.body);
      alarmsArr = []; // Empty Alarms array
      response.body.alarms.forEach(function(alarm) { // For each Group
        var myAlarm = {}; // Current alarm we are editing
        myAlarm = alarm;
        // Normalize the Alarm time, as the other script works with single values without "0" infront
        var myAlarmTime = alarm.time.split(":");
        if(myAlarmTime[0].length == 1) {
          myAlarmTime[0] = "0"+myAlarmTime[0];
        }
        if(myAlarmTime[1].length == 1) {
          myAlarmTime[1] = "0"+myAlarmTime[1];
        }
        myAlarm.time = myAlarmTime[0]+":"+myAlarmTime[1];

        // Normalize days, as the other script needs integers and we want actual days
        myAlarm.days = alarm.days;
        var weekday = new Array(7);
        weekday[0]=  "So";
        weekday[1] = "Mo";
        weekday[2] = "Di";
        weekday[3] = "Mi";
        weekday[4] = "Do";
        weekday[5] = "Fr";
        weekday[6] = "Sa";
        var newDays = Array();
        myAlarm.days.forEach(function(day) { // For each Group
          var newDay = weekday[day];
          newDays.push(newDay);
        });
        myAlarm.days = newDays;
        alarmsArr.push(myAlarm);
      });
      io.sockets.emit('getAlarmsStatus', alarmsArr); // Respond with JSON Object of btnData
    }else{
      console.log(error);
    }
  });
}

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
  var devcmd = 'curl -X POST '+obj.code+"/key -d '<key state=\"press\" sender=\"Gabbo\">POWER</key>'";
  var stat = data.status;

  console.log('Device - Command: '+send);
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

// -----------------------
// - Helper Functions -
// -----------------------

// more to come

// ----------------------------
// - BOSE Music Functions -
// ----------------------------

// - Watch and recieve devices -
// -- Watch all http servers -- TODO: Don't search on your own, use wecker.js API!
var sequence = [
    mdns.rst.DNSServiceResolve(),
    'DNSServiceGetAddrInfo' in mdns.dns_sd ? mdns.rst.DNSServiceGetAddrInfo() : mdns.rst.getaddrinfo({families:[0]}),
    mdns.rst.makeAddressesUnique()
];
var browser = mdns.createBrowser(mdns.tcp('soundtouch'), {resolverSequence: sequence});

// -- Read broadcasting devices and save them --
browser.on('serviceUp', function(service) {
  var newDevice = {};
  newDevice.name = service.name;
  newDevice.ip = service.addresses[0]
  newDevice.cmdPort = service.port; // Command Port
  newDevice.wsPort = '8080'; // WebSocket Port
  newDevice.MAC = service.txtRecord.MAC;

  var sendUrl = 'http://'+newDevice.ip+":"+newDevice.cmdPort+'/info';
  needle.get(sendUrl, function(error, response) {
    if (!error && response.statusCode == 200) {
      console.log("Successfully asked: "+newDevice.name+" for information.");
      newDevice.type = response.body.info.type;
      newDevice.Account = response.body.info.margeAccountUUID;
      console.log("Found service: "+service.name+" - IP: "+service.addresses[0]+":"+service.port+" - MAC: "+service.txtRecord.MAC);
      myBoseDevices.push(newDevice);
    }else{
      console.log("Error asking: "+newDevice.name+" for information. No device saved!");
    }
  });
});

// -- Listen to devices that go down --
browser.on('serviceDown', function(service) {
  console.log(service);
  // TODO: Remove device from myBoseDevices
});
browser.start();

// - Send Key -
function boseKey(data) {
  var key = data[0];
  xml='<key state="press" sender="Gabbo">'+key+'</key>';
  post('key', xml, 'boseButtonPressedStatus', Array(data[1]));
  xml='<key state="release" sender="Gabbo">'+key+'</key>';
  post('key', xml,'boseButtonPressedStatus', Array(data[1]));
}

// - Do a Post -
function post(page, str, socketName, socketBody) {
  console.log(str);
  var sendUrl = 'http://'+activeBoseSystem.ip+':'+activeBoseSystem.cmdPort+'/'+page;
  needle.post(sendUrl, str, function(error, response) {
    if (!error && response.statusCode == 200) {
      console.log(response.body);
      socketBody.push("success");
    }else{
      socketBody.push("error");
    }
    io.sockets.emit(socketName, socketBody); // Respond with JSON Object of btnData
  });
}

var connection; // WebSocket Connection
function listen() {
  if(activeBoseSystem.name !== "none") {
    connection = new WebSocket('ws://' + activeBoseSystem.ip + ':' + activeBoseSystem.wsPort, "gabbo");
    connection.onopen = function() {   console.log("Connection open to: "+activeBoseSystem.name); };
    connection.onmessage = function(e) {
      listenToData(e.data);
    };
    connection.onclose = function() {   console.log("Connection closed to: "+activeBoseSystem.name); };
    connection.onerror = function() {
      console.log("Connection error. ");
      setTimeout(listen, 1000);
    };
  }else{
    console.log("Currently no BOSE System to listen... (retry in 1s)");
    setTimeout(listen, 1000);
  }
}
listen();

function listenToData(data) {
  parseString(data, function (err, result) {
      cString = result;
  });

  handleBoseData(cString, "update");
}

function handleBoseData(cString, type) {
  var boseInfo = { };
  var stopSending = false; // Prevent from sending

  console.log("!!!!!Getting Data to handle!");
  console.log(cString);
  console.log(type);
  // Normalize data from Update Info or Requested Info
  if(type == "update") { // It's Update Information
    console.log("-- Song updated! --");

    boseInfo.method = "update";
    if(cString.updates.nowPlayingUpdated) {
      boseInfo.type = "Music";
      boseInfo.source = cString.updates.nowPlayingUpdated[0].nowPlaying[0].$.source;
    }else if(cString.updates.volumeUpdated) {
      boseInfo.type = "Volume";
    }else if(cString.updates.connectionStateUpdated) {
      boseInfo.type = "Connection";
    }
  }else{ // It's requested Information
    console.log("-- Song information! --");

    boseInfo.method = "info";
    if(cString.nowPlaying) {
      boseInfo.type = "Music";
      boseInfo.source = cString.nowPlaying.$.source;
      console.log(cString.nowPlaying.$.source);
    }else{
      boseInfo.type = "Volume";
    }
  }

  if(boseInfo.type == "Music") {
    if(boseInfo.source == "SPOTIFY") { // Playing Spotify
      if(boseInfo.method == "update") {
        try {
          boseInfo.artist = cString.updates.nowPlayingUpdated[0].nowPlaying[0].artist[0];
          boseInfo.time = cString.updates.nowPlayingUpdated[0].nowPlaying[0].time[0];
          boseInfo.track = cString.updates.nowPlayingUpdated[0].nowPlaying[0].track[0];
          boseInfo.trackID = cString.updates.nowPlayingUpdated[0].nowPlaying[0].trackID[0];
          boseInfo.album = cString.updates.nowPlayingUpdated[0].nowPlaying[0].album[0];
          boseInfo.coverArt = cString.updates.nowPlayingUpdated[0].nowPlaying[0].art[0]._;
          console.log("Good cString!");
          console.log(cString);
        } catch (err) {
          console.log("!!!!! ERROR !!!!!");
          console.log(err);
          console.log("Bad cString!");
          console.log(cString);
          console.log("more");
          console.log(cString.updates.nowPlayingUpdated[0]);
        }
      }else{
        boseInfo.artist = cString.nowPlaying.artist;
        boseInfo.track = cString.nowPlaying.track;
        boseInfo.trackID = cString.nowPlaying.trackID;
        boseInfo.album = cString.nowPlaying.album;
        boseInfo.coverArt = cString.nowPlaying.art._;
      }
    }else if(boseInfo.source == "INTERNET_RADIO") { // Playing Radio
        console.log("RADIOOOOO!");
        if(boseInfo.method == "update") {
          boseInfo.stationName  = cString.updates.nowPlayingUpdated[0].nowPlaying[0].stationName[0];
          boseInfo.description = cString.updates.nowPlayingUpdated[0].nowPlaying[0].description[0];
          boseInfo.coverArt = cString.updates.nowPlayingUpdated[0].nowPlaying[0].art[0]._;
          boseInfo.stationLocation = cString.updates.nowPlayingUpdated[0].nowPlaying[0].stationLocation[0];
        }else{
          boseInfo.stationName  = cString.nowPlaying.stationName ;
          boseInfo.description = cString.nowPlaying.description;
          boseInfo.coverArt = cString.nowPlaying.art._;
          boseInfo.stationLocation = cString.nowPlaying.stationLocation;
        }
    }
    if(!stopSending) {
      io.sockets.emit('boseInfoUpdate', boseInfo); // Respond with JSON Object of btnData
      console.log("____!!!! I did send !!!!_____");
      console.log(boseInfo);
    }else{
      console.log("!!I DID NOT SEND THIS SHIT");
      stopSending = false;
    }
  }else if(boseInfo.type == "Volume") {
    console.log("- Volume updated -");
    if(boseInfo.method == "update") {
      volume = cString.updates.volumeUpdated[0].volume[0].targetvolume[0];
      muted = cString.updates.volumeUpdated[0].volume[0].muteenabled[0];
    }else{
      volume = cString.volume.targetvolume;
      muted = cString.volume.muteenabled;
    }
    io.sockets.emit('boseVolumeUpdate', [volume, muted]); // Respond with JSON Object of btnData
  }else if(boseInfo.type == "Connection") {
    console.log(" - Connection updated -");
  }
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
  socket.on('boseWhatsPlaying', boseWhatsPlaying);
  socket.on('boseGetVolume', boseGetVolume);
  socket.on('boseButtonPressed', boseButtonPressed);
  socket.on('boseGetSystem', boseGetSystem);
  socket.on('boseGetDevices', boseGetDevices);
  socket.on('boseDeviceButtonPressed', boseDeviceButtonPressed);
  socket.on('alarmActiveState', alarmActiveState);
  socket.on('alarmActiveChanged', alarmActiveChanged);
  socket.on('alarmSaved', alarmSaved);
  socket.on('alarmDelete', alarmDelete);
  socket.on('alarmEdit', alarmEdit);
  socket.on('getAlarms', getAlarms);
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

  // - Read Bose Information -
  function boseWhatsPlaying(obj, callbacl) {
    if(activeBoseSystem.name !== "none") {
        var sendUrl = 'http://'+activeBoseSystem.ip+':'+activeBoseSystem.cmdPort+'/now_playing';
        needle.get(sendUrl, function(error, response) {
          if (!error && response.statusCode == 200) {
            handleBoseData(response.body, "info"); // Respond with JSON Object of btnData
          }else{
            console.log(error);
          }
        });
      }else{
        console.log("Currently no BOSE system to listen");
      }
  }

  // - Read Bose Volume -
  function boseGetVolume(obj, callback) {
    if(activeBoseSystem.name !== "none") {
      var sendUrl = 'http://'+activeBoseSystem.ip+':'+activeBoseSystem.cmdPort+'/volume';
      needle.get(sendUrl, function(error, response) {
      if (!error && response.statusCode == 200)
        handleBoseData(response.body, "info"); // Respond with JSON Object of btnData
      });
    }else{
      console.log("Currently no BOSE system to listen");
    }
  }

  // - Action on clicking Preset Button -
  function boseButtonPressed(data, callback) {
    boseKey(data);
  }

  // - Respond with active System
  function boseGetSystem(data, callback) {
    var activeSystem = "";
    if(activeBoseSystem.name === "none") {
      activeSystem = "none"
    }else{
      activeSystem = activeBoseSystem.MAC;
    }
    console.log(activeSystem);
    io.sockets.emit('boseGetSystemUpdate', activeSystem); // Respond with JSON Object of btnData
  }

  // - Respond with all known Bose devices -
  function boseGetDevices(data, callback) {
    io.sockets.emit('boseGetDevicesUpdate', myBoseDevices); // Respond with JSON Object of btnData
  }

  // - Change active BOSE System -
  function boseDeviceButtonPressed(obj) {
    var newBose = myBoseDevices.find(x=> x.MAC === obj);
    activeBoseSystem = newBose; // Change to new system
    listen(); // Listen to new System
    boseGetSystem(); // Send new active system
    console.log("- Active BOSE System changed: "+newBose.name+" -");
  }

  // -- Change alarm status --
  function alarmActiveState(data, callback) {
    var resp = Array();
    alarmsArr.forEach(function(alarm) { // For each Group
      var myAlarm = {};
      myAlarm._id = alarm._id;
      myAlarm.active = alarm.active;
      resp.push(myAlarm);
    });
    console.log("sending alarm info");
    io.sockets.emit('alarmActiveStateStatus', resp); // Respond with JSON Object of btnData
  }

  // -- Change alarm status --
  function alarmActiveChanged(data, callback) {
    var currentObject = alarmsArr.find(x=> x._id === data[0]); // Find Object where _id equals data.id
    var currentObjectIndex = alarmsArr.findIndex(x=> x._id === data[0]); // Find Object where _id equals data.id
    needle.put('http://localhost:3333/api/timer/'+currentObject._id+'?rev='+currentObject._rev+'&active='+data[1], {}, function(err, resp) {
      if (!err) {
        if(resp.body.hasOwnProperty('updated') && resp.body.hasOwnProperty('resp')) { // Everything went ok
          console.log("Changed alarm activity of: "+currentObject.name+" to: "+data[1]); // JSON decoding magic. :)
          console.log(resp.body);
          alarmsArr[currentObjectIndex]._rev = resp.body.resp.rev;
          alarmsArr[currentObjectIndex].active = resp.body.data.active;
          alarmActiveState() // Change alarm state (don't really needed as switch already changed)
          io.sockets.emit('alarmActiveChangedStatus', resp.body); // Respond with JSON Object of btnData
        }else{ // There was an error updating but the API Call was ok
          alarmActiveState() // Change alarm state back to normal
          console.log("API Prob!");
          console.log(resp.body);
        }
      }else{ // API couldn't be called
        alarmActiveState() // Change alarm state back to normal
        console.log("Error changing alarm activity");
      }
    });
  }

  // -- Save a new alarm --
  function alarmSaved(data, callback) {
    var currentObject = alarmsArr.find(x=> x._id === data[0]); // Find Object where _id equals data.id
    var currentObjectIndex = alarmsArr.findIndex(x=> x._id === data[0]); // Find Object where _id equals data.id
    needle.post('http://localhost:3333/api/timer', data, function(err, resp) {
      if (!err) {
        var myNewAlarm = {}; // Add the new alarm to the alarms
        myNewAlarm.name = resp.body.data.name;
        myNewAlarm.time = resp.body.data.time;
        myNewAlarm.days = resp.body.data.days;
        myNewAlarm.active= resp.body.data.active;
        myNewAlarm.device= resp.body.data.device;
        myNewAlarm._id= resp.body.body.id;
        myNewAlarm._rev= resp.body.rev;
        alarmsArr.push(myNewAlarm);
        io.sockets.emit('alarmSavedStatus', myNewAlarm); // Respond with JSON Object of btnData
        console.log(resp);
      }else{ // API couldn't be called
        //
        console.log("Error changing alarm activity");
      }
    });
  }

  // -- Delete an alarm --
  function alarmDelete(data, callback) {
    needle.delete('http://localhost:3333/api/timer/'+data[0]+'?rev='+data[1], 0, function(err, resp) {
      var currentObjectIndex = alarmsArr.findIndex(x=> x._id === data[0]); // Find Object where _id equals data.id
      var cResp = {};
      cResp.id = data[0];
      if(currentObjectIndex > -1) {
        cResp.name = alarmsArr[currentObjectIndex].name;
      }else{
        cResp.name = "already deleted";
      }
      cResp.success = false;
      if (!err) {
        if(!resp.body.hasOwnProperty('error')) { // Everything went ok
          cResp.success = true;
          alarmsArr.splice(currentObjectIndex, 1);
          io.sockets.emit('alarmDeleteStatus', cResp); // Respond with JSON Object of btnData
          console.log("Deleted alarm: "+cResp.name);
        }else{
          io.sockets.emit('alarmDeleteStatus', cResp); // Respond with JSON Object of btnData
          console.log("Error deleting alarm: "+cResp.name);
        }
      }else{ // API couldn't be called
        io.sockets.emit('alarmDeleteStatus', cResp); // Respond with JSON Object of btnData
        console.log("Error deleting alarm: "+cResp.name);
      }
    });
  }

  // -- Delete an alarm --
  function alarmEdit(data, callback) {
    // var currentObject = alarmsArr.find(x=> x._id === data[0]); // Find Object where _id equals data.id
    // var currentObjectIndex = alarmsArr.findIndex(x=> x._id === data[0]); // Find Object where _id equals data.id
    // needle.post('http://localhost:3333/api/timer', data, function(err, resp) {
    //   if (!err) {
    //     var myNewAlarm = {}; // Add the new alarm to the alarms
    //     myNewAlarm.name = resp.body.data.name;
    //     myNewAlarm.time = resp.body.data.time;
    //     myNewAlarm.days = resp.body.data.days;
    //     myNewAlarm.active= resp.body.data.active;
    //     myNewAlarm.device= resp.body.data.device;
    //     myNewAlarm._id= resp.body.body.id;
    //     myNewAlarm._rev= resp.body.rev;
    //     alarmsArr.push(myNewAlarm);
    //     io.sockets.emit('alarmSavedStatus', myNewAlarm); // Respond with JSON Object of btnData
    //     console.log(resp);
    //   }else{ // API couldn't be called
    //     //
    //     console.log("Error changing alarm activity");
    //   }
    // });
  }

  // -- Get all current alarms --
  function getAlarms(data, callback) {
    loadAlarms();
  }
