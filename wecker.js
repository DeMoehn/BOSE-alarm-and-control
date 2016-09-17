// jshint esversion: 6
// ---------------------------------
// - Require & Variables Setup -
// --------------------------------

// - Config File -
var config = require('./config');
console.log(config);

// - Webserver -
var express = require('express'); // Include Express
var app = express(); // Define our app using express
var bodyParser = require('body-parser');
var mdns = require('mdns'); // MDNS Tool to discover devices
var needle = require('needle'); // HTTP Handler

// - Database -
var nano = require('nano')(config.couchDB.protocol+config.couchDB.ip+":"+config.couchDB.port); // Connect to CouchDB on the PI
var db = nano.use('bosealarms'); // Connect to Database

// - Shell Scripts -
var path = require('path');
var sys = require('sys');
var exec = require('child_process').exec;

// - Configure app to use bodyParser() -
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// - Configure Variables -
var port = process.env.PORT || 3333; // Set the port
var runningAlarms = Array(); // Create an Array for all running alarms
var runningTimers = Array(); // Create an Array for all running sleeptimers
var myTimeouts = Array(); // Create an Array for all running sleeptimers
var myBoseDevices = Array();

// -----------------------
// - Startup Functions -
// -----------------------
initializeAlarms(); // Creates the alarms
var boseSystemsLoaded = false; // Indicates that now systems are found by now
var alarmInterval = setInterval(checkTime, 55000); // Start the Alarm - Interval (55sec)


// -----------------------
// - Configure Routes -
// -----------------------
var router = express.Router(); // Get an instance of the express Router

// - Middleware to use for all requests -
router.use(function(req, res, next) {
    console.log('User interaction '+req.method+": "+req.url); // Do some logging
    next(); // Make sure we go to the next routes and don't stop here
});


// - Routes for all Timer actions -
// -- Create a new Timer --
router.route('/timer').post(function(req, res) {
  if(req.body.time !== undefined && req.body.days !== undefined && req.body.name !== undefined && req.body.active !== undefined && req.body.device !== undefined) { // If all needed Parameters are set
    var data = {}; // Create new object
    data.type = "alarm"; // Type is alarm
    data.name = req.body.name; // Alarm Name
    data.time = req.body.time; // Alarm time
    data.days = req.body.days; // Alarm days
    data.active = req.body.active; // Active or inactive
    data.device = req.body.device; // Which device
    if(req.body.preset !== undefined) { // Use standard preset or custom
      data.preset = req.body.preset;
    }else{
      data.preset = 1;
    }
    data.volume = req.body.volume; // Device Volume

    db.insert(data, function(err, body, header) { // Insert Object to DB
      if (!err) {
        data._id = body.id;
        data._rev = body.rev;
        setAlarm(data);
        res.json({ok: true, data: data, body: body}); // Respond with data
      }else{
        res.json({error: true, desc: err}); // Respond with data
      }
    });

  }else if( (req.query.time === undefined) || (req.query.days === undefined) || (req.query.name === undefined) ) { // Neede Parameters not set
    res.json({error: true, desc: "Parameters (name, time, days, active and device) are needed!", data: req.query}); // Respond with error
  }
});

// -- Get all timers --
router.route('/timer').get(function(req, res) {
  var alarmsArr = Array(); // Create Array for all objects
  var alarmsCount = 0;
  db.view('alarms', 'show', function(err, body) { // Load a view that displays all alarms
    if (!err) {
      body.rows.forEach(function(alarm) {
        alarmsArr.push(alarm.value); // Add each alarm to the array
        alarmsCount++; // Count each alarm
      });
      res.json({ok:true, count: alarmsCount, alarms: alarmsArr}); // Respond with alarms
    }else{
      res.json({error:true, disc: "Could not read alarms!", err: err}); // Respond with error
    }
  });
});

// -- Delete all timers (be careful!) --
router.route('/timer').delete(function(req, res) {
  if(req.query.token === undefined) {
    res.json({error:true, disc: "Deleting all Alarms need a security token"}); // Respond with error
  }else if(req.query.token != 0815) {
    res.json({error:true, disc: "Security token is wrong"}); // Respond with error
  }else{
    var deleteAlarms = Array(); // New Array for all alarms to delete
    var alarmsDeletedCount = 0; // Count all deleted alarms
    var excludeAlarms = Array(); // Array for params to exclude certain alarms
    var excludedAlarms = Array(); // Array for the new running alarms
    var alarmsExcludedCount = 0; // Count all excluded alarms
     if(req.query.exclude !== undefined) {
       excludeAlarms = req.query.exclude;
     }

    runningAlarms.forEach(function(alarm) {
      alarm = alarm;

      var excludeAlarm = excludeAlarms.indexOf(alarm._id);
      if(excludeAlarm != -1) { // Do not delete this alarm
        excludedAlarms.push(alarm);
        alarmsExcludedCount++;
      }else{ // Delete this alarm & remove from running
        alarm._deleted = true; // Set delete Flag
        deleteAlarms.push(alarm); // Add all alarms to the delete array
        var currentAlarmIndex = runningAlarms.findIndex(x => x.id === alarm._id); // Find the alarm Index in runningAlarms
        alarmsDeletedCount++; // Increase the deleted alarms
      }
    });

    db.bulk({docs: deleteAlarms}, function(err, body) { // Delete the alarms
      if (!err) {
          runningAlarms = []; // Delete the current running alarms and initialize new from DB
          initializeAlarms();
          res.json({ok:true, deleted: alarmsDeletedCount, excluded: alarmsExcludedCount, deletedAlarms: deleteAlarms, excludedAlarms: runningAlarms, dbBody: body}); // Respond with alarms
      }else{
        res.json({error:true, disc: "Could not delete alarms!", err: err}); // Respond with error
      }
    });
  }
});

// -- Update all timers (used to enable/disable) --
router.route('/timer').put(function(req, res) {
  var updateAlarms = Array(); // New Array for all alarms to update
  var alarmsUpdatedCount = 0; // Count all updated alarms
  var excludeAlarms = Array(); // Array for params to exclude certain alarms
  var excludedAlarms = Array(); // Array for the new running alarms
  var alarmsExcludedCount = 0; // Count all excluded alarms
  if(req.query.exclude !== undefined) {
    excludeAlarms = req.query.exclude;
  }

  if(req.query.active !== undefined) {
    if(req.query.active == "true") { // If the params are set as Strings and not Booleans
      req.query.active = true;
    }else{
      req.query.active = false;
    }

    runningAlarms.forEach(function(alarm) {
      alarm = alarm;
      var excludeAlarm = excludeAlarms.indexOf(alarm._id);
      if(excludeAlarm != -1) { // Do not update this alarm
        excludedAlarms.push(alarm);
        alarmsExcludedCount++;
      }else{ // Update this alarm & run new
        alarm.active = req.query.active; // Change the alarm (Currently only to active/inactive)
        updateAlarms.push(alarm); // Add all alarms to the delete array
        alarmsUpdatedCount++; // Increase the deleted alarms
      }
    });

    db.bulk({docs: updateAlarms}, function(err, body) { // Delete the alarms
      if (!err) {
          res.json({ok:true, updated: alarmsUpdatedCount, excluded: alarmsExcludedCount, updatedAlarms: updateAlarms, excludedAlarms: excludedAlarms, dbBody: body}); // Respond with alarms
          runningAlarms = []; // Delete the current running alarms and initialize new from DB
          initializeAlarms();
      }else{
        res.json({error:true, disc: "Could not update alarms!", err: err}); // Respond with error
      }
    });
  }else{
    res.json({error:true, disc: "The param ?active must be set to true or false"}); // Respond with error
  }
});

// -- Get a specific timer --
router.route('/timer/:timer_id').get(function(req, res) {
  db.get(req.params.timer_id, function(err, body) { // Request a specific object by it's ID
    if (!err) {
      res.json({ok: true, timer:req.params.timer_id, data:body}); // Return object
    }else{
      res.json({error: true, desc: err, timer: req.params.timer_id}); // Throw error
    }
  });
});

// -- Change a specific timer --
router.route('/timer/:timer_id').put(function(req, res) {
  var rev = req.query.rev;
  if(rev === undefined) { // The Script needs the _rev (Revision) of the timer to work
    res.json({error: true, desc: "Revision (?rev) of Timer needed", timer: req.params.timer_id}); // Throw error if no ?rev was set
  }else{
    db.get(req.params.timer_id, function(err, body) { // Get the old object from the DB
      if (!err) {
        if(body._rev !== rev) {
          res.json({error: true, desc: "Revisions do not match", timer: req.params.timer_id, rev: rev, docRev: body._rev}); // Throw error if the revision from the request and the old object are not the same
        }else{
          var myAlarm = JSON.parse(JSON.stringify(body)); // This is cloning the object instead of referencing it
          var oldBody = body;

          // Check if the needed params exist in the query and change the old object
          if(req.query.name === undefined && req.query.time === undefined && req.query.days === undefined && req.query.active === undefined) {
            res.json({error: true, desc: "At least one argument (of: name, time, days or active) is needed!", timer: req.params.timer_id, rev: rev});
          }else{
            if(req.query.name !== undefined) {
              myAlarm.name = req.query.name;
            }
            if(req.query.time !== undefined) {
              myAlarm.time = req.query.time;
            }
            if(req.query.days !== undefined) {
              myAlarm.days= req.query.days;
            }
            if(req.query.active !== undefined) {
              myAlarm.active = req.query.active;
            }
            if(req.query.device !== undefined) {
              myAlarm.device = req.query.device;
            }
            if(req.query.preset !== undefined) {
              myAlarm.preset = req.query.preset;
            }


            // Insert / Update the new object
            db.insert(myAlarm, function(err2, body2) {
              if (!err) {
                res.json({updated: true, timer: req.params.timer_id, rev: rev, data: myAlarm, old: oldBody, resp: body2});
                var currentAlarmIndex = runningAlarms.findIndex(x => x.id === req.params.timer_id); // Find the current running timer Index
                console.log("Alarm edited!");
                runningAlarms.splice(currentAlarmIndex, 1); // Remove the Alarm
                setAlarm(myAlarm);
              }else{
                res.json({error: true, desc: err2, timer: req.params.timer_id, rev: rev});
              }
            });
          }
        }
      }else{
        res.json({error: true, desc: err, timer: req.params.timer_id}); // Throw error if old object couldn't be read
      }
    });
  }
});

// -- Delete a specific timer --
router.route('/timer/:timer_id').delete(function(req, res) {
  var rev = req.query.rev;
  if(rev === undefined) { // The revision (?rev) is needed for this operation
    res.json({error: true, desc: "Revision (?rev) of Timer needed", timer: req.params.timer_id}); // Throw error if no ?rev was set
  }else{
    db.destroy(req.params.timer_id, rev, function(err, body) { // Delete object by ID and Rev
      if (!err) {
        var currentAlarmIndex = runningAlarms.findIndex(x => x._id === req.params.timer_id); // Find the current running timer Index
        if(currentAlarmIndex > -1) {
          res.json({deleted: true, timer: req.params.timer_id, rev: rev, data: body});
          console.log("Alarm deleted: "+runningAlarms[currentAlarmIndex].name);
          runningAlarms.splice(currentAlarmIndex, 1); // Remove & Stop the Alarm
        }else{
          res.json({error: true, desc: err, timer: req.params.timer_id, rev: rev});
          console.log("Crazy error!");
          console.log(currentAlarmIndex);
          console.log(runningAlarms);
          console.log(req.params.timer_id);
          console.log(rev);
        }
      }else{
        res.json({error: true, desc: err, timer: req.params.timer_id, rev: rev});
      }
    });
  }
});

// -- Create a new Sleeptimer --
router.route('/sleeptimer').post(function(req, res) {
  if(req.query.time !== undefined && req.query.device !== undefined) { // If all needed Parameters are set
    var data = {}; // Create new object
    data.type = "sleeptimer";
    data.time = req.query.time;
    data.device = req.query.device;

    var d = new Date(); // Get current Date
    var cH = d.getHours();
    var cM = d.getMinutes();
    var cS = d.getSeconds();
    data.startTime = cH+":"+cM+":"+cS;

    var d2 = new Date (d.getTime() + data.time*1000); // Get end Time
    var cH2 = d2.getHours();
    var cM2 = d2.getMinutes();
    var cS2 = d2.getSeconds();
    data.endTime = cH2+":"+cM2+":"+cS2;

    var currentObject = runningTimers.find(x=> x.device === data.device); // Check if there already is a timer for that device
    if(currentObject !== undefined) {
      res.json({error: true, desc: "Sleeptimer for device already exists", data: req.query}); // Respond with data
    }else{
      runningTimers.push(data);
      setSleeptimer(data);
      console.log("Sleeptimer will be created.")
      res.json({ok: true, data: data}); // Respond with data
    }

  }else if( (req.query.time === undefined) || (req.query.days === undefined) || (req.query.name === undefined) ) { // Neede Parameters not set
    res.json({error: true, desc: "Parameters (time & device) are needed!", data: req.query}); // Respond with error
  }
});

// -- Get all Sleeptimers --
router.route('/sleeptimer').get(function(req, res) {
  res.json({ok: true, data: runningTimers}); // Respond with data
});

// -- Delete a specific sleeptimer --
router.route('/sleeptimer/:timer_device').delete(function(req, res) {
  var currentIndex = runningTimers.findIndex(x=> x.device === req.params.timer_device); // Find the current running timer Index
  var timeoutIndex = myTimeouts.findIndex(x=> x.device === req.params.timer_device); // Find the current running timer Index
  if(currentIndex >= 0) {
      if(timeoutIndex >= 0) {
        clearTimeout(myTimeouts[timeoutIndex].myTimeout);
        myTimeouts.splice(timeoutIndex, 1); // Remove the Timeout
        console.log("Timeout deleted!");
      }else{
        console.log("Timeout could not be found!");
      }
      runningTimers.splice(currentIndex, 1); // Remove the Timer
      res.json({ok: true, data: runningTimers, device: req.params.timer_device}); // Respond with data
      console.log("Sleeptimer deleted for device: "+req.params.timer_device);
  }else{
      res.json({error: true, desc: "Sleeptimer could not be found", data: req.params.timer_device}); // Respond with data
      console.log("Error deleting sleeptimer for device: "+req.params.timer_device);
  }
});

// - Router Options -
// -- Use "/api" for the router --
app.use('/api', router);

// -- Listen to the port --
app.listen(port);
console.log('Server is listening on http://localhost:'+port);


// --------------
// - Functions -
// ---------------

// - Set Alarm -
function setAlarm(data) {
  var newAlarm = {}; // Create a new Alarm Object
  newAlarm = data;
  runningAlarms.push(newAlarm);
  try {
    var currentObject = myBoseDevices.find(x=> x.MAC === data.device); // Find Object where _id equals data.id
  } catch (err) {
    var currentObject = {};
    currentObject.name = "error, retry";
    console.log(err);
    initializeAlarms();
  }
  console.log("Started Alarm: "+data.name+" (Time: "+data.time+" - Days: "+data.days.join(", ")+" - Preset: "+data.preset+" - Active: "+data.active+" - Volume: "+data.volume+") for device: "+currentObject.name);
}

// - Initialize Alarms -
function initializeAlarms() { // Reload all alarms from DB on startup
  runningAlarms = [];
  if(boseSystemsLoaded) {
    db.view('alarms', 'show', function(err, body) { // Load a view that displays all alarms
      if (!err) {
        body.rows.forEach(function(alarm) {
          alarm = alarm.value;
          setAlarm(alarm);
        });
      }else{
        console.log("ERROR! Could not start alarms! - "+err);
      }
    });
  }else{
    setTimeout(initializeAlarms, 500);
  }
}

// - Check the time -
function checkTime() {
  var date = new Date(); // Create current Date
  var currentDay = date.getDay();
  var currentHour = date.getHours();
  var currentMinute = date.getMinutes();

  if(runningAlarms.length === 0) {
    console.log("No alarms set!");
  }else{
    runningAlarms.forEach(function(alarm) {
      var alarmDays = alarm.days;
      var alarmHour = alarm.time.split(":")[0];
      var alarmMinute= alarm.time.split(":")[1];
      var currentObject = myBoseDevices.find(x=> x.MAC === alarm.device); // Find Object where _id equals data.id

      if(alarm.active === "true") {
        if( (alarmDays.indexOf(currentDay.toString()) > -1) && (currentHour == alarmHour) && (currentMinute == alarmMinute) ) {
          console.log("ALARM! Alarm: \""+alarm.name+"\" is met! Alarm time: "+alarm.time+" - Current time: "+currentHour+":"+currentMinute+" (T: "+alarm.time+" - D: "+alarm.days.join(", ")+" - P: "+alarm.preset+" - A: "+alarm.active+" - V: "+alarm.volume+" - D: "+currentObject.name+")");
          startBose("PRESET_"+alarm.preset, currentObject);
          boseVolume(parseInt(alarm.volume), currentObject);
          startBose("SHUFFLE_ON", currentObject);
        }else{
          if(alarmDays.indexOf(currentDay.toString()) > -1) {
            console.log("Alarm: \""+alarm.name+"\" (T: "+alarm.time+" - D: "+alarm.days.join(", ")+" - P: "+alarm.preset+" - A: "+alarm.active+" - V: "+alarm.volume+" - D: "+currentObject.name+") is running. Day met! Time not! - Current time: "+currentHour+":"+currentMinute);
          }else{
            console.log("Alarm: \""+alarm.name+"\" (T: "+alarm.time+" - D: "+alarm.days.join(", ")+" - P: "+alarm.preset+" - A: "+alarm.active+" - V: "+alarm.volume+" - D: "+currentObject.name+") is running. Day not met! - Current day: "+currentDay);
          }
        }
      }else{
        console.log("Alarm: \""+alarm.name+"\" is not active. (T: "+alarm.time+" - D: "+alarm.days.join(", ")+" - P: "+alarm.preset+" - A: "+alarm.active+" - V: "+alarm.volume+" - D: "+currentObject.name+")");
      }
    });
  }
}

// - Create Sleeptimer -
function setSleeptimer(data) {
  var myTimeout = setTimeout(sendStop, parseInt(data.time*1000), data.device);
  timeout = {};
  timeout.device = data.device;
  timeout.myTimeout = myTimeout;
  myTimeouts.push(timeout);
  console.log("Timer Created. Duration: "+data.time+"s - Device: "+data.device+" - Start: "+data.startTime+" - End: "+data.endTime);
}

// - Sends Stop -
function sendStop(device) {
  var currentIndex = runningTimers.findIndex(x=> x.device === device); // Find the current running timer Index
  var currentObject = myBoseDevices.find(x=> x.MAC === device); // Find Object where _id equals data.id
  if(currentIndex >= 0) {
    runningTimers.splice(currentIndex, 1); // Remove the Alarm
    console.log("Sleeptimer removed for: "+device)
    console.log(runningTimers);
  }else{
    console.log("Problem with deleting sleeptimer for: "+device)
  }

  startBose("POWER", currentObject); // Sends Power OFF/ON to Device
  console.log("BOSE Stop!! Device: "+currentObject.name);
}

// ----------------------------
// - BOSE Music Functions -
// ----------------------------

var cmdport='8090';
var wsport='8080';

// - Excecutes a Command -
function execCMD(cmd, url, endpoint) {
  cmd = 'curl -X POST '+url+"/"+endpoint+" -d '"+cmd+"'";
  exec(cmd, function (err, stdout, stderr) { // Exceute command
    if (err) {
      console.log('exec error: ' + err);
    }else{
      console.log(stdout);
    }
  });
}

// - Send Key -
function startBose(key, alarm) {
  var url = alarm.ip+':'+alarm.cmdPort;
  var cmdP = '<key state="press" sender="Gabbo">'+key+'</key>';
  var cmdR = '<key state="release" sender="Gabbo">'+key+'</key>';
  execCMD(cmdP, url, "key");
  execCMD(cmdR, url, "key");
}

function boseVolume(vol, alarm) {
  var url = alarm.ip+':'+alarm.cmdPort;
  var cmdV = '<volume>'+vol+'</volume>';
  execCMD(cmdV, url, "volume");
}

// - Watch and recieve devices -
// -- Watch all http servers --
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
      boseSystemsLoaded = true;
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
