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
      res.render('bose', {}); // Render and pass variables
}

// - Alarm Route -
function alarmRoute(req, res) {
  var sendUrl = "http://localhost:3333/api/timer";
  needle.get(sendUrl, function(error, response) {
    if (!error && response.statusCode == 200) {
      console.log(response.body);
      var alarmsArr = Array(); // Save modified alarms
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
        myAlarm.days = JSON.parse(alarm.days);
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

      res.render('alarm', {items: alarmsArr}); // Render and pass variables
    }else{
      console.log(error);
    }
  });
}

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
  //   var options = {
  // headers: { 'X-Custom-Header': 'Bumbaway atuna' }
  // }
  //
  // needle.post('https://my.app.com/endpoint', 'foo=bar', options, function(err, resp) {
  // if (!error && response.statusCode == 200)
  //   console.log(response.body);
  // });
  // });

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

var url='192.168.0.153';
var cmdport='8090';
var wsport='8080';

// - Watch and recieve devices -
// -- Watch all http servers --
//var browser = mdns.createBrowser(mdns.tcp('soundtouch'));
var sequence = [
    mdns.rst.DNSServiceResolve(),
    'DNSServiceGetAddrInfo' in mdns.dns_sd ? mdns.rst.DNSServiceGetAddrInfo() : mdns.rst.getaddrinfo({families:[0]}),
    mdns.rst.makeAddressesUnique()
];
var browser = mdns.createBrowser(mdns.tcp('soundtouch'), {resolverSequence: sequence});
browser.on('serviceUp', function(service) {
  console.log("Found service: "+service.name+" - IP: "+service.addresses[0]+":"+service.port+" - MAC: "+service.txtRecord.MAC);
  //console.log(service);
});
browser.on('serviceDown', function(service) {
  console.log(service);
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
  var sendUrl = 'http://'+url+':'+cmdport+'/'+page;
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
  connection = new WebSocket('ws://' + url + ':' + wsport, "gabbo");
  connection.onopen = function() {   console.log("Connection open. "); };
  connection.onmessage = function(e) {
    listenToData(e.data);
  };
  connection.onclose = function() {   console.log("Connection closed. "); };
  connection.onerror = function() {
      console.log("Connection error. ");
    setTimeout(listen, 1000);
  };
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
    }else{
      boseInfo.type = "Volume";
    }
  }

  if(boseInfo.type == "Music") {
    if(boseInfo.source == "SPOTIFY") { // Playing Spotify
      if(boseInfo.method == "update") {
        boseInfo.artist = cString.updates.nowPlayingUpdated[0].nowPlaying[0].artist[0];
        boseInfo.track = cString.updates.nowPlayingUpdated[0].nowPlaying[0].track[0];
        boseInfo.trackID = cString.updates.nowPlayingUpdated[0].nowPlaying[0].trackID[0];
        boseInfo.album = cString.updates.nowPlayingUpdated[0].nowPlaying[0].album[0];
        boseInfo.coverArt = cString.updates.nowPlayingUpdated[0].nowPlaying[0].art[0]._;
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
    console.log(JSON.stringify(cString));
  }else if(boseInfo.type == "Connection") {
    console.log(" - Connection updated -");
  }

  console.log(cString);
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
  socket.on('boseGetSystems', boseGetSystems);
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
    var sendUrl = 'http://'+url+':'+cmdport+'/now_playing';
    needle.get(sendUrl, function(error, response) {
    if (!error && response.statusCode == 200)
      console.log(response.body);
      //handleBoseData(response.body, "info"); // Respond with JSON Object of btnData
    });
  }

  // - Read Bose Volume -
  function boseGetVolume(obj, callbacl) {
    var sendUrl = 'http://'+url+':'+cmdport+'/volume';
    needle.get(sendUrl, function(error, response) {
    if (!error && response.statusCode == 200)
      console.log(response.body);
      //handleBoseData(response.body, "info"); // Respond with JSON Object of btnData
    });
  }

  // - Action on clicking Preset Button -
  function boseButtonPressed(data, callback) {
    boseKey(data);
  }

  // - List all Bose Systems -
  function boseGetSystems(data, callback) {
    var boseDevices = Array();
    db.view('show', 'bose', function(err, devicesBody) { // Read all Objects
      if (!err) {
        devicesBody.rows.forEach(function(deviceDoc) { // For each Group
          boseDevices.push(deviceDoc.value);
        });
      }
      io.sockets.emit('boseGetSystemsStatus', boseDevices); // Respond with JSON Object of btnData
      console.log("- Bose Systems read -");
    });
  }
