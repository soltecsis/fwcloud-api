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
router.get('/:idcluster', function (req, res)
{
    var idcluster = req.params.idcluster;
    FirewallsClusterModel.getFirewallsClusters(idcluster, function (error, datalist)
    {
        //Get data
        if (datalist && datalist.length > 0)
        {
//            var actions = datalist.map(utilsModel.decryptDataUserPass);
//            var results = Promise.all(actions);
//
//            results.then(data1 => { // or just .then(console.log)
//                logger.debug(data1);
//            });

            Promise.all(datalist.map(utilsModel.decryptDataUserPass))
                    .then(data => {
                        api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
                            res.status(200).json(jsonResp);
                        });
                    })
                    .catch(e => {
                        logger.debug("CATCH ERROR: ", e);
                    });
        }
        //get error
        else
        {
            api_resp.getJson(datalist, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});

router.get('/install/:idcluster', function (req, res)
{
    var idcluster = req.params.idcluster;
    FirewallsClusterModel.getFirewallsClustersIPData(idcluster, function (error, datalist)
    {
        //Get data
        if (datalist && datalist.length > 0)
        {
            Promise.all(datalist.map(utilsModel.decryptDataUserPass))
                    .then(data => {
                        api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
                            res.status(200).json(jsonResp);
                        });
                    })
                    .catch(e => {
                        logger.debug("CATCH ERROR: ", e);
                    });
        }
        //get error
        else
        {
            api_resp.getJson(datalist, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});



router.get('/:idcluster/:id', function (req, res)
{
    var idcluster = req.params.idcluster;
    var id = req.params.id;
    FirewallsClusterModel.getFirewallsCluster(idcluster, id, function (error, data)
    {
        //Get data
        if (data && data.length > 0)
        {
            utilsModel.decrypt(data[0].sshuser)
                    .then(sshuser_dec => {
                        data[0].sshuser = sshuser_dec;
                    })
                    .then(utilsModel.decrypt(data[0].sshpass)
                            .then(sshpass_dec => {
                                data[0].sshpass = sshpass_dec;
                            })
                            )
                    .then(() => {
                        api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
                            res.status(200).json(jsonResp);
                        });
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

router.get('/install/:idcluster/:id', function (req, res)
{
    var idcluster = req.params.idcluster;
    var id = req.params.id;
    FirewallsClusterModel.getFirewallsClustersIPData_id(idcluster, id, function (error, data)
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


router.get('/:idcluster/firewall/:idfirewall', function (req, res)
{
    var idcluster = req.params.idcluster;
    var idfirewall = req.params.idfirewall;
    FirewallsClusterModel.getFirewallsClusterFirewall(idcluster, idfirewall, function (error, datalist)
    {
        //Get data
        if (datalist && datalist.length > 0)
        {
            Promise.all(datalist.map(utilsModel.decryptDataUserPass))
                    .then(data => {
                        api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
                            res.status(200).json(jsonResp);
                        });
                    })
                    .catch(e => {
                        logger.debug("CATCH ERROR: ", e);
                    });
        }
        //get error
        else
        {
            api_resp.getJson(datalist, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});
router.get('/:idcluster/name/:name', function (req, res)
{
    var idcluster = req.params.idcluster;
    var name = req.params.name;
    FirewallsClusterModel.getFirewallsClusterName(idcluster, name, function (error, datalist)
    {
        //Get data
        if (datalist && datalist.length > 0)
        {
            Promise.all(datalist.map(utilsModel.decryptDataUserPass))
                    .then(data => {
                        api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
                            res.status(200).json(jsonResp);
                        });
                    })
                    .catch(e => {
                        logger.debug("CATCH ERROR: ", e);
                    });
        }
        //get error
        else
        {
            api_resp.getJson(datalist, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});
/* New firewallcluster */
router.post("/firewallcluster", function (req, res)
{
    //new objet with FirewallCluster data
    var FCData = {
        id: null,
        idcluster: req.body.idcluster,
        firewall: req.body.firewall,
        firewall_name: req.body.firewall_name,
        sshuser: req.body.sshuser,
        sshpass: req.body.sshpass,
        save_user_pass: req.body.save_user_pass,
        interface: req.body.interface,
        ipobj: req.body.ipobj
    };
    logger.debug(FCData);
    if (FCData.firewall === undefined || FCData.firewall === '' || isNaN(FCData.firewall)) {
        logger.error("DETECTED UNDEFINED: firewall");
        FCData.firewall = -1;
    }
    if (FCData.save_user_pass === undefined || FCData.save_user_pass === '' || isNaN(FCData.save_user_pass) || FCData.save_user_pass == 0) {
        FCData.save_user_pass = false;
    } else
        FCData.save_user_pass = true;

    //encript username and password
    utilsModel.encrypt(FCData.sshuser)
            .then(data => {
                logger.debug("SSHUSER: " + FCData.sshuser + "   ENCRYPTED: " + data);
                FCData.sshuser = data;
            })
            .then(utilsModel.encrypt(FCData.sshpass)
                    .then(data => {
                        logger.debug("SSPASS: " + FCData.sshpass + "   ENCRYPTED: " + data);
                        FCData.sshpass = data;
                    }))
            .then(() => {
                logger.debug("SAVING DATA NODE CLUSTER. SAVE USER_PASS:", FCData.save_user_pass);
                if (!FCData.save_user_pass) {
                    FCData.sshuser = '';
                    FCData.sshpass = '';
                }
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
            })
            .catch(e => {
                logger.debug(e);
            });
}
);
/* firewallcluster update */
router.put('/firewallcluster', function (req, res)
{
    //Save firewallcluster data into objet     
    var FCData = {
        id: req.body.id,
        idcluster: req.body.idcluster,
        firewall: req.body.firewall,
        firewall_name: req.body.firewall_name,
        sshuser: req.body.sshuser,
        sshpass: req.body.sshpass,
        save_user_pass: req.body.save_user_pass,
        interface: req.body.interface,
        ipobj: req.body.ipobj
    };
    if (FCData.firewall === undefined || FCData.firewall === '' || isNaN(FCData.firewall)) {
        logger.error("DETECTED UNDEFINED: firewall");
        FCData.firewall = -1;
    }

    if (FCData.save_user_pass === undefined || FCData.save_user_pass === '' || isNaN(FCData.save_user_pass) || FCData.save_user_pass == 0) {
        FCData.save_user_pass = false;
    } else
        FCData.save_user_pass = true;

    //encript username and password
    utilsModel.encrypt(FCData.sshuser)
            .then(data => {
                FCData.sshuser = data;
            })
            .then(utilsModel.encrypt(FCData.sshpass)
                    .then(data => {
                        FCData.sshpass = data;
                    }))
            .then(() => {
                logger.debug("SAVING DATA NODE CLUSTER. SAVE USER_PASS:", FCData.save_user_pass);
                if (!FCData.save_user_pass) {
                    FCData.sshuser = '';
                    FCData.sshpass = '';
                }

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
            })
            .catch(e => {
                logger.debug(e);
            });
});
/* Remove cluster */
router.put("/del/firewallcluster/:id", function (req, res)
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