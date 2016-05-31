// Module dependencies

// - Webserver & Socket IO
var express = require('express'); // Web - Framework
var doT = require('express-dot'); // Templating
var compression = require('compression'); // gzip/deflate outgoing responses
var app = express();
var server = require('http').Server(app); // Http Server
var io = require('socket.io')(server); // IO Socket

// - Shell Scripts
var path = require('path');
var sys = require('sys');
var exec = require('child_process').exec;

// - Database
var nano = require('nano')('https://demoehn:a11HQSM54!!@demoehn.cloudant.com'); // Connect to CouchDB
var db = nano.use('homeautomation'); // Connect to Database

// Define Variables
var cmd = 'pilight-send -p'; //Command to send with "pilight" and -p for Protocol (Rest comes from DB)
var files = __dirname + '/public/';

// Listen for paths
app.set('views', __dirname+'/views');
app.set('view engine', 'dot');
app.engine('dot', doT.__express); // Use dot Templating
app.use(compression()); // Use compression
app.use(express.static(__dirname + '/public')); // Use Express.static middleware to servce static files

// Server functions
app.get('/', function (req, res) {
  db.view('show', 'groups', function(err, body) {
    if (!err) {
      var counts = body.rows.length;
      body.rows.forEach(function(doc) {
        db.view('show', 'btns', {key:doc.id}, function(err, pbody) {
          if (!err) {
              counts--;
              doc.devices = pbody.rows;
              if(counts <= 0) {
                items = body.rows;
                res.render('index', {items: items}); // Render and pass variables
              }
          }
        });
      });
    }
  });
});

// Server functions
app.get('/manage', function (req, res) {
  res.render('manage', { }); // Render and pass variables
});

// Functions
// - Send to Intertechno Device
function sendToDev(devcmd, stat) {
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
    }
  });
}

// Socket.io Settings
io.on('connection', function(socket){
  console.log('a user connected');

  socket.on('disconnect', function(){
    console.log('user disconnected');
  });

  socket.on('btnPressed', function(data, callback) {
    var btnData = JSON.parse(data); // Recieve Data from the button and parse JSON

    db.get(btnData.id, function(err, body, header) { // Check if exists and get _rev
      if (err) {
        console.log('[db.header] ', err.message);
      }else{
        console.log('[db.header] ', body);
        sendToDev(body.code, btnData.status); // Send Data to the device

        db.insert(body, btnData.id, function(err, pbody, header) { // Update button
          if (err) {
            console.log('[db.insert] ', err.message);
          }else{
            console.log('you have inserted the data');
            console.log(body);

            io.sockets.emit('btnStatus', JSON.stringify(btnData)); // Respond with JSON Object of btnData
          }
        });
      }
    });
  });
});

// Start Server
server.listen(3000, function() { // Create Server on 3000
  console.log('listening on http://localhost:3000');
});
