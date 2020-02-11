/*
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/


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
errorModel.createError = (name, init) => {
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