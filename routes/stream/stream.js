var express = require('express');
var router = express.Router();
var StreamModel = require('../../models/stream/stream');
var api_resp = require('../../utils/api_response');
var objModel = 'STREAM';


var redis = require('redis');

/**
 * Property Logger to manage App logs
 *
 * @attribute logger
 * @type log4js/app
 * 
 */
var logger = require('log4js').getLogger("app");
var utilsModel = require("../../utils/utils.js");


router.get('/update-stream/compile/:iduser/:fwcloud', function (req, res) {
	try {
		var iduser = req.params.iduser;
		var fwcloud = req.params.fwcloud;
		var update = false;

		logger.warn("API CHECK FWCLOUD ACCESS USER : [" + iduser + "] --- FWCLOUD: [" + fwcloud + "]   ACTION UPDATE: " + update);

		utilsModel.checkFwCloudAccess(iduser, fwcloud, update, req, res)
		.then(resp => {
			// let request last as long as possible
			req.socket.setTimeout(99999999);
			var accessData = {sessionID: req.sessionID, iduser: iduser, fwcloud: fwcloud};
			var messageCount = 0;
			var subscriber = redis.createClient();
			var channel = StreamModel.getTagPublishCompile(accessData);

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
						// VERY IMPORTANT!!! If we want print lines in stream on the Angular interface.
						res.flush();
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

		})
		.catch(err => {
			logger.error("ERROR ---> err: " + err);
			res.write('data: ' + "\n\n");
		});
	} catch (err) { res.write('data: ' + "\n\n"); }
});


module.exports = router;