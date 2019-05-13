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
var FwcloudModel = require('../../models/fwcloud/fwcloud');

var utilsModel = require("../../utils/utils.js");
var fwcTreemodel = require('../../models/tree/tree');
const restrictedCheck = require('../../middleware/restricted');
const fwcError = require('../../utils/error_table');


/**
 * @api {POST} /fwcloud New fwcloud
 * @apiName NewFwcloud
 *  * @apiGroup FWCLOUD
 * 
 * @apiDescription Create a new FWCloud.<br>
 * One FWCloud is an agrupation of logical IP objects.
 *
 * @apiParam {String} name FWCloud's name.
 * @apiParam {String} image Image vinculated to this FWCloud..
 * @apiParam {String} comment FWCloud's comment. 
 * 
 * @apiParamExample {json} Request-Example:
 * {
 *   "name": "FWCloud-01",
 *   "image": "",
 *   "comment": "My first FWCloud."
 * }
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 200 OK
 * {
 *   "insertId": 1
 * } 
 */
router.post('/', async(req, res) => {
	try {
		req.body.fwcloud = await FwcloudModel.insertFwcloud(req);
		await fwcTreemodel.createAllTreeCloud(req);
		await utilsModel.createFwcloudDataDir(req.body.fwcloud);

		res.status(200).json({ "insertId": req.body.fwcloud });
	} catch (error) { res.status(400).json(error); }
});


/**
 * @api {PUT} /fwcloud Update fwcloud
 * @apiName UpdateFwcloud
 *  * @apiGroup FWCLOUD
 * 
 * @apiDescription Update FWCloud information.
 *
 * @apiParam {Number} fwcloud Id of the FWCloud that we want modify.
 * @apiParam {String} name FWCloud's name.
 * @apiParam {String} image Image vinculated to this FWCloud..
 * @apiParam {String} comment FWCloud's comment. 
 * 
 * @apiParamExample {json} Request-Example:
 * {
 *   "id": 1,
 *   "name": "MyFWCloud",
 *   "image": "",
 *   "comment": "My first FWCloud."
 * }
 *
 * @apiSuccessExample {json} Success-Response:
 * HTTP/1.1 200 OK
 * {
 *   "insertId": 1
 * } 
 */
router.put('/', async(req, res) => {
	try {
		await FwcloudModel.updateFwcloud(req);
		res.status(204).end();
	} catch (error) { res.status(400).json(error) }
});


/**
 * Get Fwclouds by User
 * 
 * 
 * > ROUTE CALL:  __/:iduser__      
 * > METHOD:  __GET__
 * 
 * @method getFwcloudByUser
 * 
 * @param {Integer} iduser User identifier
 * 
 * @return {JSON} Returns `JSON` Data from Fwcloud
 * @example #### JSON RESPONSE
 *    
 *       {"data" : [
 *          {  //Data Fwcloud 1       
 *           "id" : ,            //Fwcloud Identifier
 *           "created_at" : ,    //Date Created
 *           "updated_at" : ,    //Date Updated
 *           "updated_by" : ,   //User last update
 *          },
 *          {....}, //Data Fwcloud 2
 *          {....}  //Data Fwcloud ...n 
 *         ]
 *       };
 * 
 */
router.get('/all/get', (req, res) => {
	FwcloudModel.getFwclouds(req.session.user_id, (error, data) => {
		if (error) return res.status(400).json(error);

		if (data && data.length > 0)
			res.status(200).json(data);
		else
			res.status(204).end();
	});
});

/* Get fwcloud by Id */
/**
 * Get Fwclouds by ID and User
 * 
 * <br>ROUTE CALL:  <b>/get</b>
 * <br>METHOD: <b>PUT</b>
 *
 * @method getFwcloudByUser_and_ID_V2
 * 
 * @param {Integer} iduser User identifier
 * @param {Integer} id Fwcloud identifier
 * 
 * @return {JSON} Returns Json Data from Fwcloud
 */
router.put('/get', (req, res) => {
	FwcloudModel.getFwcloud(req.session.user_id, req.body.fwcloud, (error, data) => {
		if (error) return res.status(400).json(error);

		if (data && data.length > 0)
			res.status(200).json(data);
		else
			res.status(400).json(fwcError.NOT_FOUND);
	});
});





// API call for check deleting restrictions.
router.put('/restricted', restrictedCheck.fwcloud, (req, res) => res.status(204).end());

/**
 * DELETE fwcloud
 * 
 * 
 * > ROUTE CALL:  __/fwcloud/fwcloud__      
 * > METHOD:  __DELETE__
 * 
 *
 * @method DeleteFwcloud
 * 
 * @param {Integer} fwcloud Fwcloud identifier
 * @optional
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
router.put("/del",
restrictedCheck.fwcloud,
async(req, res) => {
	try {
		// Remove the fwcloud data dir.
		await utilsModel.removeFwcloudDataDir(req.body.fwcloud);
		await FwcloudModel.deleteFwcloud(req);

		res.status(204).end();
	} catch (error) { res.status(400).json(error) }
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
/*router.put('/lock', (req, res) => {
	//Save fwcloud data into objet
	var fwcloudData = { fwcloud: req.body.fwcloud, iduser: req.session.user_id };

	FwcloudModel.updateFwcloudLock(fwcloudData)
		.then(data => {
			if (data.result) {
				logger.info("FWCLOUD: " + fwcloudData.fwcloud + "  LOCKED BY USER: " + fwcloudData.iduser);
				api_resp.getJson(data, api_resp.ACR_UPDATED_OK, 'FWCLOUD LOCKED OK', objModel, null, function(jsonResp) {
					res.status(200).json(jsonResp);
				});
			} else {
				logger.info("NOT ACCESS FOR LOCKING FWCLOUD: " + fwcloudData.fwcloud + "  BY USER: " + fwcloudData.iduser);
				api_resp.getJson(data, api_resp.ACR_ERROR, 'Error locking', objModel, null, function(jsonResp) {
					res.status(200).json(jsonResp);
				});
			}
		})
		.catch(r => {
			logger.info("ERROR LOCKING FWCLOUD: " + fwcloudData.fwcloud + "  BY USER: " + fwcloudData.iduser);
			api_resp.getJson(null, api_resp.ACR_ERROR, 'Error locking', objModel, r, function(jsonResp) {
				res.status(200).json(jsonResp);
			});
		});


});*/

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
/*router.put('/unlock', (req, res) => {
	//Save fwcloud data into objet
	var fwcloudData = { id: req.body.fwcloud, iduser: req.session.user_id };
	FwcloudModel.updateFwcloudUnlock(fwcloudData)
		.then(data => {
			if (data.result) {
				logger.info("FWCLOUD: " + fwcloudData.id + "  UNLOCKED BY USER: " + fwcloudData.iduser);
				api_resp.getJson(data, api_resp.ACR_UPDATED_OK, 'FWCLOUD UNLOCKED OK', objModel, null, function(jsonResp) {
					res.status(200).json(jsonResp);
				});
			} else {
				logger.info("NOT ACCESS FOR UNLOCKING FWCLOUD: " + fwcloudData.id + "  BY USER: " + fwcloudData.iduser);
				api_resp.getJson(data, api_resp.ACR_ERROR, 'Error unlocking', objModel, null, function(jsonResp) {
					res.status(200).json(jsonResp);
				});
			}
		})
		.catch(error => {
			logger.info("ERROR UNLOCKING FWCLOUD: " + fwcloudData.id + "  BY USER: " + fwcloudData.iduser);
			api_resp.getJson(null, api_resp.ACR_ERROR, 'Error unlocking', objModel, error, function(jsonResp) {
				res.status(200).json(jsonResp);
			});
		});

});*/

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