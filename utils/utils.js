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

var FwcloudModel = require('../models/fwcloud/fwcloud');
var api_resp = require('./api_response');

utilModel.checkFwCloudAccess = function (update) {

    return function (request, response, next) {
        logger.debug("CHECK FWCLOUD ACCESS - UPDATE: ", update);

        if (request.params.iduser && request.params.fwcloud) {
            var fwcloudData = {fwcloud: request.params.fwcloud, iduser: request.params.iduser};

            logger.warn('IDUSER param was detected: ', fwcloudData.iduser);
            logger.warn('FWCLOUD param was detected: ', fwcloudData.fwcloud);

            //Checl FWCLOUD LOCK
            FwcloudModel.getFwcloudAccess(request.params.iduser, request.params.fwcloud)
                    .then(resp => {
                        //{"access": true, "locked": false, , "mylock" : true  "locked_at": "", "locked_by": ""}
                        logger.warn(resp);
                        if (resp.access && !update){
                            logger.warn("OK --> FWCLOUD ACCESS ALLOWED TO READ ");
                            request.fwc_access = true;
                            next();
                        }
                        else if (resp.access && resp.locked && resp.mylock) {  //Acces ok an locked by user
                            logger.warn("OK --> FWCLOUD ACCESS ALLOWED and LOCKED ");
                            request.fwc_access = true;
                            next();
                        } else if (resp.access && !resp.locked) {   //Acces ok and No locked
                            //GET FWCLOUD LOCK
                            FwcloudModel.updateFwcloudLock(fwcloudData)
                                    .then(data => {
                                        if (data.result) {
                                            logger.info("FWCLOUD: " + fwcloudData.fwcloud + "  LOCKED BY USER: " + fwcloudData.iduser);
                                            logger.warn("OK --> FWCLOUD ACCESS ALLOWED and GET LOCKED ");
                                            request.fwc_access = true;
                                            next();
                                        } else {
                                            logger.info("NOT ACCESS FOR LOCKING FWCLOUD: " + fwcloudData.fwcloud + "  BY USER: " + fwcloudData.iduser);
                                            api_resp.getJson(data, api_resp.ACR_ERROR, 'Error locking', '', null, function (jsonResp) {
                                                response.status(200).json(jsonResp);
                                            });
                                        }
                                    })
                                    .catch(r => {
                                        logger.info("ERROR LOCKING FWCLOUD: " + fwcloudData.fwcloud + "  BY USER: " + fwcloudData.iduser);
                                        api_resp.getJson(null, api_resp.ACR_ERROR, 'Error locking', '', r, function (jsonResp) {
                                            response.status(200).json(jsonResp);
                                        });
                                    });
                        } else if (resp.access && resp.locked && !resp.mylock) {       //Acces ok an locked by other user
                            logger.warn("KO --> FWCLOUD ACCESS LOCKED BY OTHER USER ");
                            request.fwc_access = false;
                            //next(new Error("KO --> FWCLOUD ACCESS NOT ALLOWED "));
                            api_resp.getJson(null, api_resp.ACR_ACCESS_LOCKED, ' FWCLOUD ACCESS LOCK BY OTHER USER ', '', null, function (jsonResp) {
                                response.status(200).json(jsonResp);
                            });
                        } else if (!resp.access) {       //Acces Error
                            logger.warn("KO --> FWCLOUD ACCESS NOT ALLOWED");
                            request.fwc_access = false;
                            //next(new Error("KO --> FWCLOUD ACCESS NOT ALLOWED "));
                            api_resp.getJson(null, api_resp.ACR_ACCESS_ERROR, ' FWCLOUD ACCESS NOT ALLOWED ', '', null, function (jsonResp) {
                                response.status(200).json(jsonResp);
                            });
                        }
                        logger.warn("--------------------------------------------------");

                    })
                    .catch(resp => {
                        logger.warn(resp);
                        logger.warn("ERROR --> FWCLOUD ACCESS NOT ALLOWED ");
                        logger.warn("--------------------------------------------------");
                        request.fwc_access = false;
                        api_resp.getJson(null, api_resp.ACR_ACCESS_ERROR, ' ERROR. FWCLOUD ACCESS NOT ALLOWED ', '', null, function (jsonResp) {
                            response.status(200).json(jsonResp);
                        });
                    });

        } else {
            logger.error("ERROR ---> IDUSER & FWCLOUD NOT FOUND IN URL");
            api_resp.getJson(null, api_resp.ACR_ACCESS_ERROR, 'PARAM ERROR. FWCLOUD ACCESS NOT ALLOWED ', '', null, function (jsonResp) {
                response.status(200).json(jsonResp);
            });
        }
    };
};


//Export the object
module.exports = utilModel;