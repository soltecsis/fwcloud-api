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


/**
 * Module to routing FWCloud requests
 * <br>BASE ROUTE CALL: <b>/fwclouds</b>
 *
 * @module Fwcloud
 * 
 * 
 */

/**
 * Class to manage fwcloud routing
 * 
 * 
 * @class FwcloudRouter
 * 
 */

/**
 * Property  to manage express
 *
 * @property express
 * @type express
 */
var express = require('express');

/**
 * Property  to manage Fwcloud route
 *
 * @property router
 * @type express.Router 
 */
var router = express.Router();

/**
 * Property Model to manage Fwcloud Data
 *
 * @property FwcloudModel
 * @type ../../models/fwcloud
 * 
 * 
 */
import { FwCloud } from '../../models/fwcloud/FwCloud';


var utilsModel = require('../../utils/utils');
const restrictedCheck = require('../../middleware/restricted');
import { User } from '../../models/user/User'
import { logger } from '../../fonaments/abstract-application';
const EventEmitter = require('events');
import { ProgressPayload } from '../../sockets/messages/socket-message';
const fwcError = require('../../utils/error_table');

/**
 * @api {GET} /fwcloud/get Get allowed fwclouds
 * @apiName GetAllowedFwclouds
 *  * @apiGroup FWCLOUD
 * 
 * @apiDescription Get fwcloud data for all the fwclouds to which the logged used has access.
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 200 OK
 * [
 *    {
 *        "id": 4,
 *        "name": "FWCloud-02",
 *        "created_at": "2019-05-14T11:37:19.000Z",
 *        "updated_at": "2019-05-14T11:37:19.000Z",
 *        "created_by": 0,
 *        "updated_by": 0,
 *        "locked_at": null,
 *        "locked_by": null,
 *        "locked": 0,
 *        "image": "",
 *        "comment": ""
 *    },
 *    {
 *        "id": 5,
 *        "name": "FWCloud-03",
 *        "created_at": "2019-05-14T11:37:24.000Z",
 *        "updated_at": "2019-05-14T11:57:06.000Z",
 *        "created_by": 0,
 *        "updated_by": 0,
 *        "locked_at": "2019-05-14T11:57:06.000Z",
 *        "locked_by": 1,
 *        "locked": 1,
 *        "image": "",
 *        "comment": ""
 *		}
 *	}
 * ]
 * 
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 400 Bad Request
 */
router.get('/all/get', async (req, res) => {
	try {
		const data = await FwCloud.getFwclouds(req.dbCon, req.session.user_id);
		if (data && data.length > 0)
			res.status(200).json(data);
		else
			res.status(204).end();
	} catch(error) {
		logger().error('Error getting all fwcloud: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * @api {PUT} /fwcloud/get Get fwcloud data
 * @apiName GetFwcloud
 *  * @apiGroup FWCLOUD
 * 
 * @apiDescription Get fwcloud data.
 *
 * @apiParam {Number} fwcloud FWCloud's id.
 * 
 * @apiParamExample {json} Request-Example:
 * {
 *   "fwcloud": 3
 * }
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 200 OK
 * {
 *    "id": 3,
 *    "name": "FWCloud-Updated",
 *    "created_at": "2019-05-14T11:37:15.000Z",
 *    "updated_at": "2019-05-14T11:37:54.000Z",
 *    "created_by": 0,
 *    "updated_by": 0,
 *    "locked_at": "2019-05-14T11:37:51.000Z",
 *    "locked_by": 1,
 *    "locked": 1,
 *    "image": "",
 *    "comment": "Comment for the updated fwcloud."
 * }
 * 
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 400 Bad Request
 * {
 *    "fwcErr": 7000,
 *    "msg": "FWCloud access not allowed"
 * }
 */
router.put('/get', (req, res) => {
	FwCloud.getFwcloud(req.session.user_id, req.body.fwcloud, (error, data) => {
		if (error) return res.status(400).json(error);

		if (data && data.length > 0)
			res.status(200).json(data[0]);
		else {
			logger().error('Error getting a fwcloud: ' + JSON.stringify(fwcError.NOT_FOUND));
			res.status(400).json(fwcError.NOT_FOUND);
		}
	});
});


/**
 * @api {PUT} /fwcloud/restricted Check delete restrictions
 * @apiName RestrictedFwcloud
 *  * @apiGroup FWCLOUD
 * 
 * @apiDescription Check if the fwcloud indicated as a parameter has any deletion restriction.
 *
 * @apiParam {Number} fwcloud Id of the FWCloud for which we want check its restrictions.
 * 
 * @apiParamExample {json} Request-Example:
 * {
 *   "fwcloud": 2
 * }
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 204 No Content
 * 
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 400 Bad Request
 * {
 *    "fwcErr": 7000,
 *    "msg": "FWCloud access not allowed"
 * }
 */
router.put('/restricted', restrictedCheck.fwcloud, (req, res) => res.status(204).end());


/**
 * @api {PUT} /fwcloud/del Delete fwcloud
 * @apiName DeleteFwcloud
 *  * @apiGroup FWCLOUD
 * 
 * @apiDescription Delete the firewall cloud indicated in the request body.<br>
 * If the fwcloud has any restrictions, the deletion will not be done.
 *
 * @apiParam {Number} fwcloud Id of the FWCloud that we want delete.
 * 
 * @apiParamExample {json} Request-Example:
 * {
 *   "fwcloud": 2
 * }
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 204 No Content
 * 
 * @apiErrorExample {json} Error-Response:
 * HTTP/1.1 400 Bad Request
 * {
 *    "fwcErr": 7000,
 *    "msg": "FWCloud access not allowed"
 * }
 */
router.put('/del',
restrictedCheck.fwcloud,
async(req, res) => {
	try {
		// Only users with the administrator role can delete a fwcloud.
		if (!await User.isLoggedUserAdmin(req))
			throw fwcError.NOT_ADMIN_USER;

		// Remove all the fwcloud database related information.
		const fwc = new FwCloud();
		fwc.id = req.body.fwcloud;
		await fwc.remove();

		// Remove the fwcloud data dir.
		await utilsModel.removeFwcloudDataDir(req.body.fwcloud);

		res.status(204).end();
	} catch (error) {
		logger().error('Error removing a fwcloud: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * Lock fwcloud status
 * 
 * 
 * > ROUTE CALL:  __/fwcloud/fwcloud/lock__      
 * > METHOD:  __PUT__
 * 
 *
 * @method UpdateFwcloudLock
 * 
 * @param {Integer} fwcloud Fwcloud id
 * @optional
 * @param {Integer} iduser User identifier
 * 
 * @return {JSON} Returns Json result
 * @example 
 * #### JSON RESPONSE OK:
 *    
 *       {"data" : [
 *          { 
 *           "msg : "success",   //result
 *          }
 *         ]
 *       };
 *       
 * #### JSON RESPONSE ERROR:
 *    
 *       {"data" : [
 *          { 
 *           "msg : ERROR,   //Text Error
 *          }
 *         ]
 *       };
 */
router.put('/lock', async (req, res) => {
    const channel = new EventEmitter();
    const fwcloudData = { fwcloud: req.body.fwcloud, iduser: req.session.user_id, lock_session_id: req.sessionID };

    try {
        const data = await FwCloud.updateFwcloudLock(fwcloudData);
        if (data.result) {
            logger().info("FWCLOUD: " + fwcloudData.fwcloud + "  LOCKED BY USER: " + fwcloudData.iduser);
            channel.emit('progress', new ProgressPayload('fwcloud', 'lock', 'success', 'FWCLOUD LOCKED OK'));
            return res.status(200).json({
                result: true,
                message: 'FWCLOUD LOCKED OK',
            });
        } else {
            logger().info("NOT ACCESS FOR LOCKING FWCLOUD: " + fwcloudData.fwcloud + "  BY USER: " + fwcloudData.iduser);
            channel.emit('progress', new ProgressPayload('fwcloud', 'lock', 'error', 'NOT ACCESS FOR LOCKING'));
            return res.status(200).json({
                result: false,
                message: 'NOT ACCESS FOR LOCKING',
                info: {
                    locked_by: data.lockByUser,
                    ip_user: req.socket.remoteAddress
                }
            });
        }
    } catch (error) {
        logger().info("ERROR LOCKING FWCLOUD: " + fwcloudData.fwcloud + "  BY USER: " + fwcloudData.iduser);
        return res.status(200).json({
            result: false,
            message: 'ERROR LOCKING: ' + error,
        });
    }
});

/**
 * Unlock fwcloud status
 * 
 * 
 * > ROUTE CALL:  __/fwcloud/fwcloud/unlock__      
 * > METHOD:  __PUT__
 * 
 *
 * @method UpdateFwcloudUnlock
 * 
 * @param {Integer} fwcloud Fwcloud cloud
 * @optional
 * @param {Integer} iduser User identifier
 * 
 * @return {JSON} Returns Json result
 * @example 
 * #### JSON RESPONSE OK:
 *    
 *       {"data" : [
 *          { 
 *           "msg : "success",   //result
 *          }
 *         ]
 *       };
 *       
 * #### JSON RESPONSE ERROR:
 *    
 *       {"data" : [
 *          { 
 *           "msg : ERROR,   //Text Error
 *          }
 *         ]
 *       };
 */
router.put('/unlock', async (req, res) => {
	// Save fwcloud data into object
	const fwcloudData = { id: req.body.fwcloud, iduser: req.session.user_id, lock_session_id: req.sessionID };
	try {
		const data = await FwCloud.updateFwcloudUnlock(fwcloudData);
		if (data.result) {
			logger().info("FWCLOUD: " + fwcloudData.fwcloud + "  UNLOCKED BY USER: " + fwcloudData.iduser);
			res.status(200).json({
				result: true,
				message: 'FWCLOUD UNLOCKED OK',
			});
		} else {
			logger().info("NOT ACCESS FOR UNLOCKING FWCLOUD: " + fwcloudData.id + "  BY USER: " + fwcloudData.iduser);
			res.status(200).json({
				result: false,
				message: 'NOT ACCESS FOR UNLOCKING',
			});
		}
	} catch (error) {
		logger().info("ERROR UNLOCKING FWCLOUD: " + fwcloudData.id + "  BY USER: " + fwcloudData.iduser);
		res.status(200).json({
			result: false,
			message: 'ERROR UNLOCKING: ' + error,
		});
	}
});

/* Get locked Status of fwcloud by Id */
/**
 * Get Locked status of Fwcloud by ID and User
 * 
 * <br>ROUTE CALL:  <b>/locked</b>
 * <br>METHOD: <b>GET</b>
 *
 * @method getLockedStatusFwcloudByUser_and_ID
 * @param {Integer} iduser User identifier
 * @param {Integer} id Fwcloud identifier
 * 
 * @return {JSON} Returns Json Data from Fwcloud
 */
/*router.get('/lock/get', (req, res) => {
	var iduser = req.session.user_id;
	var fwcloud = req.params.fwcloud;
	if (!isNaN(fwcloud)) {
		FwcloudModel.getFwcloud(iduser, fwcloud, function(error, data) {
			//get fwcloud data
			if (data && data.length > 0) {

				var resp = { "locked": false, "at": "", "by": "" };
				if (data[0].locked === 1) {
					resp = { "locked": true, "at": data[0].locked_at, "by": data[0].locked_by };
				}

				api_resp.getJson(resp, api_resp.ACR_OK, '', "", null, function(jsonResp) {
					res.status(200).json(jsonResp);
				});
			}
			//get error
			else {
				api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function(jsonResp) {
					res.status(200).json(jsonResp);
				});
			}
		});
	}
	//id must be numeric
	else {
		api_resp.getJson(null, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function(jsonResp) {
			res.status(200).json(jsonResp);
		});
	}
});*/

module.exports = router;