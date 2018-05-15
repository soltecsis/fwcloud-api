/**
 * Module to manage responses
 * <br>BASE ROUTE CALL: <b>/firewalls</b>
 *
 * @module api_response
 * 
 * 
 */

/**
 * Class to manage firewalls routing
 *
 * @class respModel
 * 
 */

/**
 * Property Model to manage response Data
 *
 * @property respModel
 * @type ../../utils/api_response
 * 
 * 
 */
var respModel = {};

//const VError = require('verror').VError;
//const WError = require('verror').WError;

/**
 * Property ACR_ERROR
 *
 * @property ACR_ERROR
 * @type String
 */
respModel.ACR_ERROR = 'ACR_ERROR';
/**
 * Property ACR_OK
 *
 * @property ACR_OK
 * @type String
 */
respModel.ACR_OK = 'ACR_OK';
/**
 * Property reACR_NOTEXISTsp
 *
 * @property ACR_NOTEXIST
 * @type String
 */
respModel.ACR_NOTEXIST = 'ACR_NOTEXIST';
/**
 * Property resp
 *
 * @property ACR_MISSING
 * @type String
 */
respModel.ACR_MISSING = 'ACR_MISSING';
/**
 * Property ACR_DELETED_OK
 *
 * @property ACR_DELETED_OK
 * @type String
 */
respModel.ACR_DELETED_OK = 'ACR_DELETED_OK';
/**
 * Property ACR_RESTRICTED
 *
 * @property ACR_RESTRICTED
 * @type String
 */
respModel.ACR_RESTRICTED = 'ACR_RESTRICTED';
/**
 * Property ACR_INSERTED_OK
 *
 * @property ACR_INSERTED_OK
 * @type String
 */
respModel.ACR_INSERTED_OK = 'ACR_INSERTED_OK';
/**
 * Property ACR_UPDATED_OK
 *
 * @property ACR_UPDATED_OK
 * @type String
 */
respModel.ACR_UPDATED_OK = 'ACR_UPDATED_OK';
/**
 * Property ACR_DATA_ERROR
 *
 * @property ACR_DATA_ERROR
 * @type String
 */
respModel.ACR_DATA_ERROR = 'ACR_DATA_ERROR';
/**
 * Property ACR_NOT_ALLOWED
 *
 * @property ACR_NOT_ALLOWED
 * @type String
 */
respModel.ACR_NOT_ALLOWED = 'ACR_NOT_ALLOWED';
/**
 * Property ACR_PARAM_ERROR
 *
 * @property ACR_PARAM_ERROR
 * @type String
 */
respModel.ACR_PARAM_ERROR = 'ACR_PARAM_ERROR';

/**
 * Property ACR_ACCESS_ERROR
 *
 * @property ACR_ACCESS_ERROR
 * @type String
 */
respModel.ACR_ACCESS_ERROR = 'ACR_ACCESS_ERROR';

/**
 * Property ACR_SESSION_ERROR
 *
 * @property ACR_SESSION_ERROR
 * @type String
 */
respModel.ACR_SESSION_ERROR = 'ACR_SESSION_ERROR';

/**
 * Property ACR_ACCESS_LOCKED
 *
 * @property ACR_ACCESS_LOCKED
 * @type String
 */
respModel.ACR_ACCESS_LOCKED = 'ACR_ACCESS_LOCKED';

/**
 * Property ACR_COMPILED_OK
 *
 * @property ACR_COMPILED_OK
 * @type String
 */
respModel.ACR_COMPILED_OK = 'ACR_COMPILED_OK';

/**
 * Property ACR_CONFIRM_ASK
 *
 * @property ACR_CONFIRM_ASK
 * @type String
 */
respModel.ACR_CONFIRM_ASK = 'ACR_CONFIRM_ASK';

/**
 * Property Logger to manage App logs
 *
 * @attribute logger
 * @type log4js/app
 * 
 */
var logger = require('log4js').getLogger("app");

/* para control de errores
 const errReqFail = new Error('Request failed');
 const errReqStatus = new VError(errReqFail, 'Unexpected status code "%s"', '500');
 const errReq = new WError(errReqStatus, 'Internal error');
 
 console.error(errReq.message); //Internal error:
 // get some real data for logging
 console.info(errReq.toString()); //
 */

/**
 * ### GET JSON RESONSE
 * 
 * @method getJson
 * 
 * @param {Object} data  Data response from Call
 * @param {String} respCode  Response code
 * @param {String} custom_response custom Message from Call
 * @param {String} custom_obj  Custon name of object
 * @param {Object} error Object Error
 * @param {Callback} callback function(jsonresp)  
 * 
 * @return {JSON} Returns Json result
 * @example 
 * #### JSON RESPONSE :
 *    
 *      {"response": {
 *        "respStatus": true | false,
 *        "respCode": "ACR_CODE",
 *        "respCodeMsg": "",
 *        "respMsg": "",
 *        "errorCode": "",
 *        "errorMsg": ""
 *      },
 *      "data": {}
 *      };
 *       
 */
respModel.getJson = function (data, respCode, custom_response, custom_obj, error, callback) {
    var resp_json = "";
    var error_code = "";
    var error_msg = "";


    if (error) {
        error_code = error.code;
        error_msg = error.message;
    }
    if (data === null)
        data = {};
    this.getMsgCodeResp(respCode, custom_obj, error, function (respStatus, respMsg) {
        resp_json = {"response": {
                "respStatus": respStatus,
                "respCode": respCode,
                "respCodeMsg": respMsg,
                "respMsg": custom_response,
                "errorCode": error_code,
                "errorMsg": error_msg},
            "data": data};

        // If error, then log it.
        if (error || respCode.search("ERROR")>=0)
            logger.debug(resp_json);

        callback(resp_json);
    });


};

/**
 * ### GET Message from Response Code
 * 
 * @method getMsgCodeResp
 * 
 * @param {String} respCode  Response code
 * @param {String} custom_response custom Message from Call
 * @param {String} custom_obj  Custon name of object
 * @param {Object} error Object Error
 * @param {Callback} callback function(status,message)  
 * 
 * @return {boolean, String} Returns Status and message response
 */
respModel.getMsgCodeResp = function (respCode, custom_obj, error, callback) {
    var msg = "";
    var status = false;

    switch (respCode) {
        case this.ACR_ERROR:
            status = false;
            if (error) {
                switch (error.code) {
                    case 'ER_NO_REFERENCED_ROW_2' :
                        msg = 'foreign Data reference error';
                        break;
                    case 'ER_DUP_ENTRY':
                        msg = 'Duplicated Data';
                        break;
                    default:
                        msg = "Internal Error";
                }
            }
            break;
        case this.ACR_OK:
            status = true;
            msg = "Ok";
            break;
        case this.ACR_NOTEXIST:
            status = false;
            msg = custom_obj + " not exist";
            break;
        case this.ACR_MISSING:
            status = false;
            msg = custom_obj + " not exist";
            break;
        case this.ACR_DATA_ERROR:
            status = false;
            msg = custom_obj + " Data error";
            break;
        case this.ACR_DELETED_OK:
            status = true;
            msg = custom_obj + " delete success";
            break;
        case this.ACR_INSERTED_OK:
            status = true;
            msg = custom_obj + " insert success";
            break;
        case this.ACR_UPDATED_OK:
            status = true;
            msg = custom_obj + " update success";
            break;
        case this.ACR_RESTRICTED:
            status = false;
            msg = custom_obj + " restricted";
            break;
        case this.ACR_NOT_ALLOWED:
            status = false;
            msg = custom_obj + " not allowed";
            break;
        case this.ACR_PARAM_ERROR:
            status = false;
            msg = custom_obj + " param error";
            break;
        case this.ACR_ACCESS_ERROR:
            status = false;
            msg = custom_obj + " Access not allowed by user access";
            break;
        case this.ACR_ACCESS_LOCKED:
            status = false;
            msg = custom_obj + " Access not allowed by lock status";
            break;
        case this.ACR_COMPILED_OK:
            status = true;
            msg = custom_obj + " compile success";
            break;    
        case this.ACR_CONFIRM_ASK:
            status = true;
            msg = custom_obj + " Confirmation ask";
            break;    
        default:
            status = false;
            msg = "unknown error";
    }

    callback(status, msg);
};



//Export the object
module.exports = respModel;