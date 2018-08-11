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

//Serve web client
app.get('/', function (req, res) {
    console.log('Request for /');
    res.render('home', {
        port: app.get('port')
    });
});

//Allow POST of a single line in JSON format
app.post('/api/lines', function (req, res) {
    console.log('/api/lines called');

    //Set bounds of usable area of Line-Us platform
    //See https://github.com/Line-us/Line-us-Programming/blob/master/Documentation/LineUsDrawingArea.pdf
    var bound_x_low = 700;
    var bound_x_high = 1625;
    var bound_y_low = -1000;
    var bound_y_high = 1000;

    var gcode_commands = []; //Array of pending gcode_commands
    //Encode requested line as GCODE format
    var line_parsed = JSON.parse(req.body.line);
    for (var i in line_parsed) {
        var gcode_command = '';

        //Invert x
        line_parsed[i].x = Math.abs(line_parsed[i].x - 1);

        //Bounds calculation from percentage coordinates to Line-Us platform bounds
        var x = ((bound_x_high - bound_x_low) * line_parsed[i].x) + bound_x_low;
        var y = ((bound_y_high - bound_y_low) * line_parsed[i].y) + bound_y_low;

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
