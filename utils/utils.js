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


utilModel.checkParameters = function (obj, callback) {
    for (var propt in obj) {
        logger.debug(propt + ': ' + obj[propt]);
        if (obj[propt] === undefined) {
            //logger.debug("PARAMETRO UNDEFINED: " + propt);
            obj[propt] = null;
        }
    }
    callback(obj);
};

utilModel.checkEmptyRow = function (obj, callback) {
    var resp = true;
    logger.debug(obj);
    if (obj === null)
        resp = false;
    else if (obj === undefined)
        resp = false;
    else if (obj.length === 0)
        resp = false;
    logger.debug(resp);
    callback(resp);
};


//Export the object
module.exports = utilModel;