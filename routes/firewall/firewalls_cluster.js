/**
 * Module to routing CLUSTER requests
 * <br>BASE ROUTE CALL: <b>/firewalls_cluster</b>
 *
 * @module FirewallsCluster
 * 
 * @requires express
 * @requires FirewallsClustermodel
 * 
 */


/**
 * Clase to manage FIREWALLS CLUSTER DATA
 *
 * @class FirewallsClusterRouter
 */


/**
 * Property  to manage express
 *
 * @property express
 * @type express
 */
var express = require('express');

/**
 * Property  to manage  route
 *
 * @property router
 * @type express.Router 
 */
var router = express.Router();


/**
 * Property Model to manage API RESPONSE data
 *
 * @property api_resp
 * @type ../../models/api_response
 * 
 */
var api_resp = require('../../utils/api_response');

/**
 * Property to identify Data Object
 *
 * @property objModel
 * @type text
 */
var objModel = 'FIREWALLS_CLUSTER';

/**
 * Property Model to manage Cluster Data
 *
 * @property FirewallsClusterModel
 * @type ../../models/firewalls_cluster
 */
var FirewallsClusterModel = require('../../models/firewall/firewalls_cluster');

var utilsModel = require("../../utils/utils.js");

var logger = require('log4js').getLogger("app");


/**
 * My method description.  Like other pieces of your comment blocks, 
 * this can span multiple lines.
 * ROUTE CALL:  /
 *
 * @method getfirewallsclusters
 * 
 * @param {String} foo Argument 1
 * @param {Object} config A config object
 * @param {String} config.name The name on the config object
 * @param {Function} config.callback A callback function on the config object
 * @param {Boolean} [extra=false] Do extra, optional work
 * @return {Boolean} Returns true on success
 */
router.get('/:idcluster',  function (req, res)
{
    var idcluster= req.params.idcluster;
    FirewallsClusterModel.getFirewallsClusters( idcluster, function (error, data)
    {
        //Get data
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
});

router.get('/:idcluster/:id',  function (req, res)
{
    var idcluster= req.params.idcluster;
    var id= req.params.id;
    
    FirewallsClusterModel.getFirewallsCluster( idcluster,id,  function (error, data)
    {
        //Get data
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
});

router.get('/:idcluster/firewall/:idfirewall',  function (req, res)
{
    var idcluster= req.params.idcluster;
    var idfirewall= req.params.idfirewall;
    
    FirewallsClusterModel.getFirewallsClusterFirewall( idcluster,idfirewall,  function (error, data)
    {
        //Get data
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
});

router.get('/:idcluster/name/:name',  function (req, res)
{
    var idcluster= req.params.idcluster;
    var name= req.params.name;
    
    FirewallsClusterModel.getFirewallsClusterName( idcluster,name,  function (error, data)
    {
        //Get data
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
});



/* New firewallcluster */
router.post("/firewallcluster",  function (req, res)
{
    //new objet with FirewallCluster data
    var FCData = {
        id: null,
        idcluster: req.body.idcluster,
        firewall: req.body.idfirewall,
        firewall_name:  req.body.firewall_name,
        sshuser: req.body.sshuser,
        sshpass: req.body.sshpass,
        interface: req.body.interface,
        ipobj: req.body.ipobj        
    };
    logger.debug(FCData);
    
    FirewallsClusterModel.insertFirewallCluster(FCData, function (error, data)
    {
        //get cluster info
        if (data && data.insertId)
        {
            var dataresp = {"insertId": data.insertId};
            api_resp.getJson(dataresp, api_resp.ACR_INSERTED_OK, 'CLUSTER INSERTED OK', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        } else
        {
            api_resp.getJson(data, api_resp.ACR_ERROR, 'Error inserting', objModel, error, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});

/* firewallcluster update */
router.put('/firewallcluster',  function (req, res)
{
    //Save firewallcluster data into objet     
    var FCData = {
        id: req.body.id,
        idcluster: req.body.idcluster,
        firewall: req.body.idfirewall,
        firewall_name:  req.body.firewall_name,
        sshuser: req.body.sshuser,
        sshpass: req.body.sshpass,
        interface: req.body.interface,
        ipobj: req.body.ipobj        
    };
    FirewallsClusterModel.updateFirewallCluster(FCData, function (error, data)
    {
        //cluster ok
        if (data && data.result)
        {
            api_resp.getJson(null, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        } else
        {
            api_resp.getJson(data, api_resp.ACR_ERROR, 'Error updating', objModel, error, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});

/* Get cluster by Id */
router.get('/firewallcluster/:id',  function (req, res)
{
    var id = req.params.id;

    if (!isNaN(id))
    {
        FirewallsClusterModel.getFirewallCluster(id, function (error, data)
        {
            //cluster ok
            if (data && data.length > 0)
            {
//                res.render("update_cluster",{ 
//                    title : "", 
//                    info : data
//                });
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
    } else
    {
        api_resp.getJson(null, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
            res.status(200).json(jsonResp);
        });
    }
});



/* Remove cluster */
router.put("/del/firewallcluster/:id",  function (req, res)
{

    var id = req.param('id');
    FirewallsClusterModel.deleteFirewallCluster(id, function (error, data)
    {
        if (data && data.result)
        {
            api_resp.getJson(data, api_resp.ACR_DELETED_OK, '', objModel, null, function (jsonResp) {
                    res.status(200).json(jsonResp);
                });
        } else
        {
            api_resp.getJson(data, api_resp.ACR_ERROR, 'Error deleting', objModel, error, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});

module.exports = router;