// jshint esversion: 6


// ---------------------------------
// - Require & Variables Setup -
// --------------------------------

// - Webserver -
var express = require('express'); // Include Express
var app = express(); // Define our app using express
var bodyParser = require('body-parser');

// - Database -
var nano = require('nano')('https://demoehn:a11HQSM54!!@demoehn.cloudant.com'); // Connect to CouchDB
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

// -----------------------
// - Startup Functions -
// -----------------------
initializeAlarms(); // Load all saved alarms from DB
var alarmInterval = setInterval(checkTime, 55000); // Start the Alarm - Interval (55sec)
// TODO: Do some further testing!
// startBose("PRESET_5");
// boseVolume(20);
// startBose("SHUFFLE_ON");


// -----------------------
// - Configure Routes -
// -----------------------
var router = express.Router(); // Get an instance of the express Router

// - Middleware to use for all requests -
router.use(function(req, res, next) {
    console.log('Something is happening.'); // Do some logging
    next(); // Make sure we go to the next routes and don't stop here
});


// - Routes for all Timer actions -
// -- Create a new Timer --
router.route('/timer').post(function(req, res) {
  if(req.query.time !== undefined && req.query.days !== undefined && req.query.name !== undefined) { // If all needed Parameters are set
    var data = {}; // Create new object
    data.type = "alarm";
    data.name = req.query.name;
    data.time = req.query.time;
    data.days = req.query.days;
    data.active = true;

    db.insert(data, function(err, body, header) { // Insert Object to DB
      if (!err) {
        setAlarm(data);
        res.json({ok: true, data: data, body: body}); // Respond with data
      }else{
        res.json({error: true, desc: err}); // Respond with data
      }
    });

  }else if( (req.query.time === undefined) || (req.query.days === undefined) || (req.query.name === undefined) ) { // Neede Parameters not set
    res.json({error: true, desc: "Parameters (time, days and name) are needed!", data: req.query}); // Respond with error
  }
});

// -- Get all timers --
router.route('/timer').get(function(req, res) {
  var alarmsArr = Array(); // Create Array for all objects
  var alarmsCount = 0;
  db.view('alarms', 'show', function(err, body) { // Load a view that displays all alarms
    if (!err) {
      body.rows.forEach(function(alarm) {
        alarmsArr.push(alarm.value); // Add all alarms to the array
        alarmsCount++;
      });
      res.json({ok:true, count: alarmsCount, alarms: alarmsArr}); // Respond with alarms
    }else{
      res.json({error:true, disc: "Could not read alarms!", err: err}); // Respond with error
    }
  });
});

// -- Delete all timers (Be careful!) --
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

            // Insert / Update the new object
            db.insert(myAlarm, function(err2, body2) {
              if (!err) {
                res.json({updated: true, timer: req.params.timer_id, rev: rev, data: myAlarm, old: oldBody, resp: body2});

                var currentAlarmIndex = runningAlarms.findIndex(x => x.id === req.params.timer_id); // Find the current running timer Index
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
        var currentAlarmIndex = runningAlarms.findIndex(x => x.id === req.params.timer_id); // Find the current running timer Index
        runningAlarms.splice(currentAlarmIndex, 1); // Remove & Stop the Alarm

        res.json({deleted: true, timer: req.params.timer_id, rev: rev, data: body});
      }else{
        res.json({error: true, desc: err, timer: req.params.timer_id, rev: rev});
      }
    });
  }
});

// -- Create a new Sleeptimer -- // TODO: Create Sleeptimer
router.route('/sleeptimer').post(function(req, res) {
  if(req.query.time !== undefined && req.query.days !== undefined && req.query.name !== undefined) { // If all needed Parameters are set
    var data = {}; // Create new object
    data.type = "alarm";
    data.name = req.query.name;
    data.time = req.query.time;
    data.days = req.query.days;
    data.active = true;

    db.insert(data, function(err, body, header) { // Insert Object to DB
      if (!err) {
        setAlarm(data);
        res.json({ok: true, data: data, body: body}); // Respond with data
      }else{
        res.json({error: true, desc: err}); // Respond with data
      }
    });

  }else if( (req.query.time === undefined) || (req.query.days === undefined) || (req.query.name === undefined) ) { // Neede Parameters not set
    res.json({error: true, desc: "Parameters (time, days and name) are needed!", data: req.query}); // Respond with error
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
  console.log("Started Alarm: "+data.name);
}

// - Initialize Alarms -
function initializeAlarms() { // Reload all alarms from DB on startup
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

      if(alarm.active === true) {
        if( (alarmDays.includes(currentDay)) && (currentHour == alarmHour) && (currentMinute == alarmMinute) ) {
          console.log("ALARM! Alarm: "+alarm.name+" is met! Alarm time: "+alarm.time+" - Current time: "+currentHour+":"+currentMinute);
          startBose();
        }else{
          if(alarmDays.includes(currentDay)) {
            console.log("Alarm: "+alarm.name+" is running. Day met! Alarm time: "+alarm.time+" - Current time: "+currentHour+":"+currentMinute);
          }else{
            console.log("Alarm: "+alarm.name+" is running. Day not met! Days: "+alarm.days);
          }
        }
      }else{
        console.log("Alarm: "+alarm.name+" is not active");
      }
    });
  }
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
function startBose(key) {
  var url = '192.168.0.135:8090'; // 192.168.0.153 - 135 (office)
  var cmdP = '<key state="press" sender="Gabbo">'+key+'</key>';
  var cmdR = '<key state="release" sender="Gabbo">'+key+'</key>';
  execCMD(cmdP, url, "key");
  execCMD(cmdR, url, "key");

  // var devcmd = 'curl -X POST '+url+"/key -d '<key state=\"press\" sender=\"Gabbo\">POWER</key>'";
  // exec(devcmd, function (err, stdout, stderr) { // Exceute command
  //   if (err) {
  //     console.log('exec error: ' + err);
  //   }else{
  //     console.log(stdout);
  //   }
  // });
  // var url2='192.168.0.153:8090'; // 192.168.0.153 - 135 (office)
  // var devcmd2 = 'curl -X POST '+url2+"/key -d '<key state=\"press\" sender=\"Gabbo\">POWER</key>'";
  // exec(devcmd2, function (err, stdout, stderr) { // Exceute command
  //   if (err) {
  //     console.log('exec error: ' + err);
  //   }else{
  //     console.log(stdout);
  //   }
  // });
}

function boseVolume(vol) {
  var url = '192.168.0.135:8090'; // 192.168.0.153 - 135 (office)
  var cmdV = '<volume>'+vol+'</volume>';
  execCMD(cmdV, url, "volume");
}
