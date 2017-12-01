//create object
var errorModel = {};

/**
 * Property Logger to manage App logs
 *
 * @property logger
 * @type log4js/app
 * 
 */
var logger = require('log4js').getLogger("app");



/**
 *
 * @param {String } name is the name of the newly created error
 * @param {Function} [init] optional initialization function
 * @returns {Err} The new Error
 */
errorModel.createError = function (name, init) {
    function Err(message) {
        Error.captureStackTrace(this, this.constructor);
        this.message = message;
        init && init.apply(this, arguments);
    }

    Err.prototype = new Error();
    //set the name property
    Err.prototype.name = name;
    // set the constructor
    Err.prototype.constructor = Err;
    return Err;
};


//Export the object
module.exports = errorModel;