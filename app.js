/*
Node implementation of a web interface controlling a Line-Us
Network Pen Robot https://www.line-us.com
Author: Jonathan Hassall https://github.com/jonhassall
*/
var http = require('http');
var express = require('express');
var handlebars = require('express-handlebars');
var bodyParser = require('body-parser')
var net = require('net');

var app = express();

//Default to port 3000
app.set('port', process.env.PORT || 3000);

//Use Handlebars for views
app.engine('handlebars', handlebars({ defaultLayout: 'main' }));
app.set('view engine', 'handlebars');

//Serve static assets from public directory
app.use(express.static('public'));

//Parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

//Parse application/json
app.use(bodyParser.json())

//Hostname for Line-Us robot
//Ensure you have Bonjour installed for mDNS support
//If you experience problems, consider setting a hosts entry
var host = 'line-us.local';

//Set bounds of usable area of Line-Us platform
//See https://github.com/Line-us/Line-us-Programming/blob/master/Documentation/LineUsDrawingArea.pdf
var bound_x_min = 700;
var bound_x_max = 1625;
var bound_y_min = -1000;
var bound_y_max = 1000;
var bound_z_min = 100;
var bound_z_max = 1000;

//Current pen position
var current_x = 1000;
var current_y = 1000;
var current_z = 1000;

//Timestamp when pen will be automatically lifted, to prevent pen being damaged
var penUp_time = 0;
var checkPenUp_timer;

//Serve web client
app.get('/', function (req, res) {
    console.log('Request for /');
    res.render('home', {
        port: app.get('port')
    });
});

//------------------------------------------------------------------------------
//Part 1: Buttons/API methods that use the WebSockets technique
app.post('/api/pendown', function (req, res) {
    move('pendown', res);
});
app.post('/api/penup', function (req, res) {
    move('penup', res);
});
app.post('/api/down', function (req, res) {
    move('down', res);
});
app.post('/api/up', function (req, res) {
    move('up', res);
});
app.post('/api/left', function (req, res) {
    move('left', res);
});
app.post('/api/right', function (req, res) {
    move('right', res);
});
app.post('/api/ul', function (req, res) {
    move('ul', res);
});
app.post('/api/ur', function (req, res) {
    move('ur', res);
});
app.post('/api/dl', function (req, res) {
    move('dl', res);
});
app.post('/api/dr', function (req, res) {
    move('dr', res);
});
app.post('/api/home', function (req, res) {
    ws.send("G28");
    current_x = 1000;
    current_y = 1000;
    current_z = 1000;
    res.send('OK');
});
app.post('/api/ping', function (req, res) {
    ws.ping();
    res.send('OK');
});

//const WebSocket = require('ws');
const WebSocket = require('isomorphic-ws')
const ws = new WebSocket('ws://' + host, {
    autoConnect: true,
    autoReconnect: true
});
wsSetup();

function wsSetup() {
    ws.on('open', () => {
        console.log('open');
    });
    ws.on('close', () => {
        console.log('close');
    });
    ws.on('ping', () => {
        console.log('ping');
    });
    ws.on('error', (error) => {
        this.emit('error', 'LineUs: websocket error: ' + e.error.message)
    });
    ws.on('message', function incoming(data) {
        console.log('ws on message');
        console.log(data);
    });
}

//Set a timer that will automatically lift the pen after 5 seconds to prevent damage to the pen
function penUpTimer_set() {
    penUp_time = Date.now() + 5000;
    console.log('penUp_timer set: ' + penUp_time);
    penUpTimer_stop();
    checkPenUp_timer = setInterval(function () {
        console.log("Compare " + Date.now() + " with " + penUp_time);
        if (Date.now() >= penUp_time) {
            console.log('time to stop it');
            move('penup');
            penUpTimer_stop();
        }
    }, 1000);
}
//Clear the pen timer
function penUpTimer_stop() {
    clearInterval(checkPenUp_timer);
}

//Move the pen using a command. Res is optional and is an Express response object
function move(command, res) {
    // ws.ping()
    console.log('move ' + command);
    switch (command) {
        case 'pendown':
            current_z = bound_y_min;
            break;
        case 'penup':
            current_z = bound_y_max;
            break;
        case 'down':
            current_y = current_y - 15;
            break;
        case 'up':
            current_y = current_y + 15;
            break;
        case 'left':
            current_x = current_x - 15;
            break;
        case 'right':
            current_x = current_x + 15;
            break;
        case 'ul':
            current_y = current_y + 15;
            current_x = current_x - 15;
            break;
        case 'ur':
            current_y = current_y + 15;
            current_x = current_x + 15;
            break;
        case 'dl':
            current_y = current_y - 15;
            current_x = current_x - 15;
            break;
        case 'dr':
            current_y = current_y - 15;
            current_x = current_x + 15;
            break;
    }

    //Deal with maximums
    if (current_x > bound_x_max) { current_x = bound_x_max; };
    if (current_x < bound_x_min) { current_x = bound_x_min; };
    if (current_y > bound_y_max) { current_y = bound_y_max; };
    if (current_y < bound_y_min) { current_y = bound_y_min; };
    if (current_z > bound_z_max) { current_z = bound_z_max; };
    if (current_z < bound_z_min) { current_z = bound_z_min; };

    gcode_command = 'G01 X' + Math.round(current_x) + ' Y' + Math.round(current_y);
    gcode_command += ' Z' + current_z;

    if (command != "penup") {
        //Set the pen auto up anti-damage timer
        penUpTimer_set();
    } else {
        //Clear the pen auto up anti-damage timer
        penUpTimer_stop();
    }

    console.log("Sending: " + gcode_command);

    ws.send(gcode_command, function ack(error) {
        console.log('Sent');
        if (error) {
            console.log(error);
            if (res) {
                res.status(500)
            }
        } else {
            if (res) {
                res.send('OK');
            }
        }
    });
};

//------------------------------------------------------------------------------
//Part 2: API methods that use the HTTP API technique
//Allow POST of a single line in JSON format
app.post('/api/lines', function (req, res) {
    console.log('/api/lines called');

    var gcode_commands = []; //Array of pending gcode_commands
    //Encode requested line as GCODE format
    var line_parsed = JSON.parse(req.body.line);
    for (var i in line_parsed) {
        var gcode_command = '';

        //Invert x
        line_parsed[i].x = Math.abs(line_parsed[i].x - 1);

        //Bounds calculation from percentage coordinates to Line-Us platform bounds
        var x = ((bound_y_max - bound_y_min) * line_parsed[i].x) + bound_y_min;
        var y = ((bound_y_max - bound_y_min) * line_parsed[i].y) + bound_y_min;

        //Round coordinates
        gcode_command = 'G01 X' + Math.round(x) + ' Y' + Math.round(y);

        //Z0 is pen down, Z1000 is pen up
        if (i < line_parsed.length - 1) {
            gcode_command += ' Z0';
        } else {
            gcode_command += ' Z1000';
        }

        gcode_commands.push(gcode_command);
    }
    console.log(gcode_commands);

    //Open new net socket to Line-Us
    var client = new net.Socket();
    var cmdIndex = 0;

    client.connect(1337, host, function () {
        console.log('Connected');
        cmdIndex = 0;
    });

    //Based on pandrr's example
    client.on('data', function (data) {
        console.log('Received: ' + data);

        //Last command (or connecting) was successful, so send a new command
        if (data.indexOf("hello") == 0 || data.indexOf("ok ") == 0) {
            console.log('cmdIndex: ' + cmdIndex);
            console.log('Sending: ' + gcode_commands[cmdIndex]);
            client.write(gcode_commands[cmdIndex] + '\x00\n');
            cmdIndex++;
        }

        //Error handler
        if (data.indexOf('error') == 0) {
            console.log('Error in command ' + cmdIndex);
            console.log('Disconnecting...');
            client.destroy();
        }

        //End of commands
        if (cmdIndex == gcode_commands.length) {
            console.log('Finished!');
            client.destroy();
        }
    });

    client.on('close', function () {
        console.log('Connection closed');
    });
    res.send('OK');
});

//Custom 404 page
app.use(function (req, res, next) {
    res.type('text/plain');
    res.status(404);
    res.send('404 - Not Found');
});

//Custom 500 page
app.use(function (err, req, res, next) {
    console.error(err.stack);
    res.type('text/plain');
    res.status(500);
    res.send('500 - Server Error');
});

//Start Express server
app.listen(app.get('port'), function () {
    console.log('Express started on http://localhost:' +
        app.get('port') + '; press Ctrl-C to terminate.');
});

console.log('Server started on localhost:' + app.get('port') + '; press Ctrl-C to terminate...');
