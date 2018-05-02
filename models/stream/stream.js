/**
 * Module to manage REDIS PUBLISH
 * <br>BASE ROUTE CALL: <b>/stream</b>
 *
 * @module stream
 * 
 * 
 */

/**
 * Class to manage API Log Streaming
 *
 * @class streamModel
 * 
 */

/**
 * Property Model to manage  API Log Streaming
 *
 * @property streamModel
 * @type /models/stream
 * 
 * 
 */
var streamModel = {};

//var db = require('../../db.js');

var redis = require('redis');
var publisherClient = redis.createClient();
var dateTime = require('node-datetime');

/**
 * Property MSG_COMPILE_RULE
 *
 * @property MSG_COMPILE_RULE
 * @type Integer
 */
streamModel.MSG_COMPILE_RULE = 'compile_rule';

/**
 * Property MSG_UPDATE_RULE
 *
 * @property MSG_UPDATE_RULE
 * @type Integer
 */
streamModel.MSG_UPDATE_RULE = 'update_rule';

/**
 * Property MSG_UPDATE_OBJ
 *
 * @property MSG_UPDATE_OBJ
 * @type Integer
 */
streamModel.MSG_UPDATE_OBJ = 'update_obj';

/**
 * Property MSG_LOCK_CLOUD
 *
 * @property MSG_LOCK_CLOUD
 * @type Integer
 */
streamModel.MSG_LOCK_CLOUD = 'lock_cloud';

/**
 * Property Logger to manage App logs
 *
 * @attribute logger
 * @type log4js/app
 * 
 */
var logger = require('log4js').getLogger("app");

streamModel.getTagPublishCompile = (accessData) => {    
	var tagPublish = accessData.iduser + '-' + accessData.sessionID + '-' + streamModel.MSG_COMPILE_RULE;
	logger.debug("TAG PUBLISH: [" + tagPublish + "]");
	return  tagPublish;
};

streamModel.pushMessageCompile = (accessData, data) => {
	try {
		var dt = dateTime.create();
		var dtf = dt.format('d-m-Y H:M:S');

		//create json structure for rule compile
		var stream_json = {"stream": {
			"iduser": accessData.iduser,
			"fwcloud": accessData.fwcloud,
			"dt": dtf,
			"stream_type": streamModel.MSG_COMPILE_RULE,
			"data": data}
		};

		//publisherClient.publish(streamModel.getTagPublishCompile(accessData), JSON.stringify(stream_json));
		publisherClient.publish(streamModel.getTagPublishCompile(accessData), data);
			
	} catch (err) {
		logger.error("Error en pushMessageCompile ");
		logger.error(err);
	}
};

//Export the object
module.exports = streamModel;
