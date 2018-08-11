var LineUsSender = {
    init: function() {
        var self = this;

        //Initialize canvas and context
        var canvas, ctx;
        var canvas = document.getElementById("myCanvas");
        var ctx = canvas.getContext("2d");
    
        //Initialize mouse coodinates and line arrays
        var mouse = { x: 0, y: 0 };
        var prev_mouse = { x: 0, y: 0 };
        var current_line = [];
        var lines = [];
    
        //Mouse capturing listener
        canvas.addEventListener('mousemove', function (e) {
            prev_mouse.x = mouse.x;
            prev_mouse.y = mouse.y;
            mouse.x = e.pageX - this.offsetLeft;
            mouse.y = e.pageY - this.offsetTop;
        }, false);
    
        //Drawing settings
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'red';
    
        //Canvas event listeners to allow drawing lines
        canvas.addEventListener('mousedown', function (e) {
            current_line.push({ x: (mouse.x / canvas.width), y: (mouse.y / canvas.height) })
            canvas.addEventListener('mousemove', onPaint, false);
        }, false);
    
        canvas.addEventListener('mouseup', function () {
            lines.push(current_line);
            self.sendLine(current_line); //Send the line to the Node API
            current_line = [];
            canvas.removeEventListener('mousemove', onPaint, false);
        }, false);
    
        var onPaint = function () {
            current_line.push({ x: (mouse.x / canvas.width), y: (mouse.y / canvas.height) })   
            ctx.beginPath();
            ctx.moveTo(prev_mouse.x, prev_mouse.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.closePath();
            ctx.stroke();
        };
    },
    sendLine: function(line) {
        //Send JSON line data to the Node API
        $.ajax({
            type: "POST",
            url: '/api/lines',
            data: {
                line: JSON.stringify(line)
            },
            success: function(data) {
                console.log('Success sending line');
            },
            error: function(data) {
                console.log('Error sending line');
            }
        });
    }
};

//Initialize the LineUsSender when the DOM is fully loaded (page is ready)
$(document).ready(function () {
    LineUsSender.init();
});