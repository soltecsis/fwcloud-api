var express = require('express');
var router = express.Router();
var StreamModel = require('../../models/stream/stream');
var api_resp = require('../../utils/api_response');
var objModel = 'STREAM';


var redis = require('redis');
var publisherClient = redis.createClient();

/**
 * Property Logger to manage App logs
 *
 * @attribute logger
 * @type log4js/app
 * 
 */
var logger = require('log4js').getLogger("app");
var utilsModel = require("../../utils/utils.js");


router.get('/update-stream/compile',  function (req, res) {


    try {
        // let request last as long as possible
        req.socket.setTimeout(99999999);
        var accessData = {sessionID: req.sessionID, iduser: req.params.iduser, fwcloud: req.params.fwcloud};

        
        
        var messageCount = 0;
        var subscriber = redis.createClient();
        
        var channel= StreamModel.getTagPublishCompile(accessData);

        logger.debug("REQUESTING SUBSCRIPTON STREAMING COMPILE DATA. CHANNEL : " + channel);
        
        
        subscriber.subscribe(channel);

        // In case we encounter an error...print it out to the console
        subscriber.on("error", function (err) {
            logger.debug("Redis Error: " + err);
        });

        // When we receive a message from the redis connection
        subscriber.on("message", function (channel, message) {
            messageCount++; // Increment our message count

            logger.debug("CHANNEL: " + channel);
            logger.debug("RECEIVING STREAMING COMPILE DATA: " + messageCount + "  MSG: " + message);
            

            //res.write('id: ' + messageCount + '\n');
            //res.write("data: " + message + '\n\n'); // Note the extra newline

            // Flush out line by line.
            var str = message;
            var lines = str.split("\n");
            for (var i in lines) {
                if (i == lines.length - 1) {
                    str = lines[i];
                } else {
                    // Note: The double-newline is *required*
                    res.write('data: ' + lines[i] + "\n\n");
                }
            }
        });

        //send headers for event-stream connection
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        res.write('\n');

        // The 'close' event is fired when a user closes their browser window.
        // In that situation we want to make sure our redis channel subscription
        // is properly shut down to prevent memory leaks...and incorrect subscriber
        // counts to the channel.
        req.on("close", function () {
            subscriber.unsubscribe();
            subscriber.quit();
        });
    } catch (err) {
        res.write('data: ' + "\n\n");
    }
});

router.get('/update-stream/compile', function (req, res) {


    try {
        // let request last as long as possible
        req.socket.setTimeout(99999999);
        var accessData = {sessionID: req.sessionID, iduser: "1", fwcloud: "1"};

        
        
        var messageCount = 0;
        var subscriber = redis.createClient();
        
        var channel= StreamModel.getTagPublishCompile(accessData);

        logger.debug("REQUESTING SUBSCRIPTON STEAMING COMPILE DATA. CHANNEL : " + channel);
        
        
        subscriber.subscribe(channel);

        // In case we encounter an error...print it out to the console
        subscriber.on("error", function (err) {
            logger.debug("Redis Error: " + err);
        });

        // When we receive a message from the redis connection
        subscriber.on("message", function (channel, message) {
            messageCount++; // Increment our message count

            logger.debug("CHANNEL: " + channel);
            logger.debug("RECEIVING STREAMING COMPILE DATA: " + messageCount + "  MSG: " + message);
            

            //res.write('id: ' + messageCount + '\n');
            //res.write("data: " + message + '\n\n'); // Note the extra newline

            // Flush out line by line.
            var str = message;
            var lines = str.split("\n");
            for (var i in lines) {
                if (i == lines.length - 1) {
                    str = lines[i];
                } else {
                    // Note: The double-newline is *required*
                    res.write('data: ' + lines[i] + "\n\n");
                }
            }
        });

        //send headers for event-stream connection
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        res.write('\n');

        // The 'close' event is fired when a user closes their browser window.
        // In that situation we want to make sure our redis channel subscription
        // is properly shut down to prevent memory leaks...and incorrect subscriber
        // counts to the channel.
        req.on("close", function () {
            subscriber.unsubscribe();
            subscriber.quit();
        });
    } catch (err) {
        res.write('data: ' + "\n\n");
    }
});

router.get('/fire-event/:event_name', function (req, res) {
    var event_name = req.params.event_name;

    publisherClient.publish(event_name, ('"' + req.params.event_name + '"'));
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write('All clients have received "' + req.params.event_name + '"');
    res.end();
});



module.exports = router;