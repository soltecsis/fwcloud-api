/**
 * Module to routing Firewalls requests
 * <br>BASE ROUTE CALL: <b>/firewalls</b>
 *
 * @module Firewall
 * 
 * 
 */

/**
 * Class to manage firewalls routing
 * 
 * 
 * @class FirewallRouter
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
 * Property  to manage Firewall route
 *
 * @property router
 * @type express.Router 
 */
var router = express.Router();

/**
 * Property Model to manage API RESPONSE data: {{#crossLinkModule "api_response"}}{{/crossLinkModule}}
 *
 * @property api_resp
 * @type api_respModel
 * 
 */
var api_resp = require('../../utils/api_response');

/**
 * Property to identify Data Object
 *
 * @property objModel
 * @type text
 */
var objModel = 'FIREWALL';

/**
 * Property Model to manage Firewall Data
 *
 * @property FirewallModel
 * @type ../../models/firewall/firewall
 * 
 * 
 */
var FirewallModel = require('../../models/firewall/firewall');

/**
 * Property Model to manage Fwcloud Data
 *
 * @property FwcloudModel
 * @type ../../models/fwcloud
 * 
 * 
 */
var FwcloudModel = require('../../models/fwcloud/fwcloud');

/**
 * Property Logger to manage App logs
 *
 * @attribute logger
 * @type log4js/app
 * 
 */
var logger = require('log4js').getLogger("app");


var utilsModel = require("../../utils/utils.js");


/**
 * Get Firewalls by User
 * 
 * 
 * > ROUTE CALL:  __/firewalls/:iduser__      
 * > METHOD:  __GET__
 * 
 * @method getFirewallByUser
 * 
 * @param {Integer} iduser User identifier
 * 
 * @return {JSON} Returns `JSON` Data from Firewall
 * @example #### JSON RESPONSE
 *    
 *       {"data" : [
 *          {  //Data Firewall 1       
 *           "id" : ,            //Firewall Identifier
 *           "cluster" : ,       //Cluster
 *           "fwcloud" : ,       //Id Firewall cloud
 *           "name" : ,          //Firewall name
 *           "comment" : ,       //comment
 *           "created_at" : ,    //Date Created
 *           "updated_at" : ,    //Date Updated
 *           "by_user" : ,       //User last update
 *           "id_fwb" :          //ID firewall in FWbuilder
 *          },
 *          {....}, //Data Firewall 2
 *          {....}  //Data Firewall ...n 
 *         ]
 *       };
 * 
 */
router.get('',  function (req, res)
{
    var iduser = req.iduser;
    FirewallModel.getFirewalls(iduser, function (error, data)
    {
        //Get data
        if (data && data.length > 0)
        {
            api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
        //Get error
        else
        {
            api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});


/**
 * Get Firewalls by User and ID
 * 
 * 
 * > ROUTE CALL:  __/firewalls/:iduser/:id__      
 * > METHOD:  __GET__
 * 
 * @method getFirewallByUser_and_Id
 * 
 * @param {Integer} iduser User identifier
 * @param {Integer} id firewall identifier
 * 
 * @return {JSON} Returns `JSON` Data from Firewall
 * @example #### JSON RESPONSE
 *    
 *       {"data" : [
 *          {  //Data Firewall        
 *           "id" : ,            //Firewall Identifier
 *           "cluster" : ,       //Cluster
 *           "fwcloud" : ,       //Id Firewall cloud
 *           "name" : ,          //Firewall name
 *           "comment" : ,       //comment
 *           "created_at" : ,    //Date Created
 *           "updated_at" : ,    //Date Updated
 *           "by_user" : ,       //User last update
 *           "id_fwb" :          //ID firewall in FWbuilder
 *          }
 *         ]
 *       };
 * 
 */
router.get('/:id',  function (req, res)
{
    var iduser = req.iduser;
    var id = req.params.id;
    var fwcloud = req.fwcloud;

    FirewallModel.getFirewall(iduser, fwcloud, id, function (error, data)
    {
        //Get Data
        if (data && data.length > 0)
        {
            api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
        //get Error
        else
        {
            api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});

/* Get firewall by Id */
/**
 * Get Firewalls by ID and User
 * 
 * <br>ROUTE CALL:  <b>/firewalls/:iduser/firewall/:id</b>
 * <br>METHOD: <b>GET</b>
 *
 * @method getFirewallByUser_and_ID_V2
 * 
 * @param {Integer} iduser User identifier
 * @param {Integer} id Firewall identifier
 * 
 * @return {JSON} Returns Json Data from Firewall
 */
router.get('/firewall/:id',  function (req, res)
{
    var id = req.params.id;
    var iduser = req.iduser;
    var fwcloud = req.fwcloud;

    if (!isNaN(id))
    {
        FirewallModel.getFirewall(iduser, fwcloud, id, function (error, data)
        {
            //get firewall data
            if (data && data.length > 0)
            {
                api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
                    res.status(200).json(jsonResp);
                });

            }
            //get error
            else
            {
                api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
                    res.status(200).json(jsonResp);
                });
            }
        });
    }
    //id must be numeric
    else
    {
        api_resp.getJson(null, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
            res.status(200).json(jsonResp);
        });
    }
});

/**
 * Get Firewalls by User and Name
 * 
 * 
 * > ROUTE CALL:  __/firewalls/:iduser/fwname/:name__      
 * > METHOD:  __GET__
 * 
 * @method getFirewallByUser_and_Name
 * 
 * @param {Integer} iduser User identifier
 * @param {String} name firewall name
 * 
 * @return {JSON} Returns `JSON` Data from Firewall
 * @example #### JSON RESPONSE
 *    
 *       {"data" : [
 *          {  //Data Firewall 1       
 *           "id" : ,            //Firewall Identifier
 *           "cluster" : ,       //Cluster
 *           "fwcloud" : ,       //Id Firewall cloud
 *           "name" : ,          //Firewall name
 *           "comment" : ,       //comment
 *           "created_at" : ,    //Date Created
 *           "updated_at" : ,    //Date Updated
 *           "by_user" : ,       //User last update
 *           "id_fwb" :          //ID firewall in FWbuilder
 *          },
 *          {....}, //Data Firewall 2
 *          {....}  //Data Firewall ...n 
 *         ]
 *       };
 * 
 */
router.get('/fwname/:name',  function (req, res)
{
    var iduser = req.iduser;
    var name = req.params.name;
    FirewallModel.getFirewallName(iduser, name, function (error, data)
    {
        //Get data
        if (data && data.length > 0)
        {
            api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
        //Get error
        else
        {
            api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});


/**
 * Get Firewalls by Cluster
 * 
 * 
 * > ROUTE CALL:  __/firewalls/:iduser/cluster/:idcluster__      
 * > METHOD:  __GET__
 * 
 * @method getFirewallByUser_and_Cluster
 * 
 * @param {Integer} iduser User identifier
 * @param {Number} idcluster Cluster identifier
 * 
 * @return {JSON} Returns `JSON` Data from Firewall
 * @example #### JSON RESPONSE
 *    
 *       {"data" : [
 *          {  //Data Firewall 1       
 *           "id" : ,            //Firewall Identifier
 *           "cluster" : ,       //Cluster
 *           "fwcloud" : ,       //Id Firewall cloud
 *           "name" : ,          //Firewall name
 *           "comment" : ,       //comment
 *           "created_at" : ,    //Date Created
 *           "updated_at" : ,    //Date Updated
 *           "by_user" : ,       //User last update
 *           "id_fwb" :          //ID firewall in FWbuilder
 *          },
 *          {....}, //Data Firewall 2
 *          {....}  //Data Firewall ...n 
 *         ]
 *       };
 * 
 */
router.get('/cluster/:idcluster', function (req, res)
{
    var iduser = req.iduser;
    var idcluster = req.params.idcluster;
    FirewallModel.getFirewallCluster(iduser, idcluster, function (error, data)
    {
        //get data
        if (data && data.length > 0)
        {
            api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
        //Get Error
        else
        {
            api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});




/**
 * CREATE New firewall
 * 
 * 
 * > ROUTE CALL:  __/firewalls/firewall__      
 * > METHOD:  __POST__
 * 
 *
 * @method AddFirewall
 * 
 * @param {Integer} id Firewall identifier (AUTO)
 * @param {Integer} iduser User identifier
 * @param {Integer} cluster Cluster identifier
 * @param {String} name Firewall Name
 * @param {String} [comment] Firewall comment
 * 
 * @return {JSON} Returns Json result
 * @example 
 * #### JSON RESPONSE OK:
 *    
 *       {"data" : [
 *          { 
 *           "insertId : ID,   //firewall identifier           
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
router.post("/firewall",  function (req, res)
{

    var firewallData = {
        id: null,
        cluster: req.body.cluster,
        name: req.body.name,
        comment: req.body.comment,
        fwcloud: req.body.fwcloud
    };
    var iduser = req.body.iduser;
    FirewallModel.insertFirewall(iduser, firewallData, function (error, data)
    {

        if (data && data.insertId)
        {
            var dataresp = {"insertId": data.insertId};
            api_resp.getJson(dataresp, api_resp.ACR_INSERTED_OK, 'INSERTED OK', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        } else
        {
            api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});


/**
 * UPDATE firewall
 * 
 * 
 * > ROUTE CALL:  __/firewalls/firewall__      
 * > METHOD:  __PUT__
 * 
 *
 * @method UpdateFirewall
 * 
 * @param {Integer} id Firewall identifier
 * @optional
 * @param {Integer} iduser User identifier
 * @param {Integer} cluster Cluster identifier
 * @param {String} name Firewall Name
 * @param {String} comment Firewall comment
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
router.put('/firewall',utilsModel.checkFirewallAccess,  function (req, res)
{

    //Save firewall data into objet
    var firewallData = {id: req.body.id, name: req.body.name, cluster: req.body.cluster, user: req.body.user, comment: req.body.comment, fwcloud: req.body.fwcloud};

    FirewallModel.updateFirewall(firewallData, function (error, data)
    {
        //Saved ok
        if (data && data.result)
        {
            api_resp.getJson(data, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        } else
        {
            api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});



/* Get locked Status of firewall by Id */
/**
 * Get Locked status of Firewall by ID and User
 * 
 * <br>ROUTE CALL:  <b>/firewalls/:iduser/firewall/:id/locked</b>
 * <br>METHOD: <b>GET</b>
 *
 * @method getLockedStatusFirewallByUser_and_ID_V2
 * 
 * @param {Integer} iduser User identifier
 * @param {Integer} id Firewall identifier
 * 
 * @return {JSON} Returns Json Data from Firewall
 */
router.get('/accesslock/:id', function (req, res)
{
    var id = req.params.id;
    var iduser = req.iduser;
    var fwcloud = req.fwcloud;


    if (!isNaN(id))
    {
        FirewallModel.getFirewall(iduser, fwcloud, id, function (error, data)
        {
            //get firewall data
            if (data && data.length > 0)
            {
                FwcloudModel.getFwcloudAccess(iduser, fwcloud)
                        .then(resp => {
                            api_resp.getJson(resp, api_resp.ACR_OK, '', "", null, function (jsonResp) {
                                res.status(200).json(jsonResp);
                            });
                        })
                        .catch(err => {
                            api_resp.getJson(err, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
                                res.status(200).json(jsonResp);
                            });
                        });
            }
        });
    }
    //id must be numeric
    else
    {
        api_resp.getJson(null, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
            res.status(200).json(jsonResp);
        });
    }
});




/**
 * DELETE firewall
 * 
 * 
 * > ROUTE CALL:  __/firewalls/firewall__      
 * > METHOD:  __DELETE__
 * 
 *
 * @method DeleteFirewall
 * 
 * @param {Integer} id Firewall identifier
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
//FALTA CONTROLAR BORRADO EN CASCADA y PERMISOS 
router.put("/del/firewall/:id",utilsModel.checkFirewallAccess,  function (req, res)
{

    var id = req.param('id');
    var iduser = req.param('iduser');
    FirewallModel.deleteFirewall(iduser, id, function (error, data)
    {
        if (data && data.result)
        {
            api_resp.getJson(data, api_resp.ACR_DELETED_OK, '', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        } else
        {
            api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});

module.exports = router;