//create object
var utilModel = {};

/**
 * Property Logger to manage App logs
 *
 * @property logger
 * @type log4js/app
 * 
 */
var logger = require('log4js').getLogger("app");


utilModel.checkParameters = function checkParameters(obj, callback) {
    for (var propt in obj) {
        logger.debug(propt + ': ' + obj[propt]);
        if (obj[propt] === undefined) {
            //logger.debug("PARAMETRO UNDEFINED: " + propt);
            obj[propt] = null;
        }
    }
    callback(obj);
};


//Export the object
module.exports = utilModel;