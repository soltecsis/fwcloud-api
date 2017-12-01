var express = require('express');
var api_resp = require('../utils/api_response');
var objModel = 'CLUSTER';
/**
 * Module to routing CLUSTER requests
 * <br>BASE ROUTE CALL: <b>/clusters</b>
 *
 * @module ClusterRouter
 * 
 * @requires express
 * @requires Clustermodel
 * 
 */
var router = express.Router();


var ClusterModel = require('../models/cluster');

/**
 * Modulo para gestionar los datos del Cluster
 * <br>BASE ROUTE CALL: <b>/clusters</b>
 *
 * @class ClusterRouter
 * 
 */

/**
 * Property Logger to manage App logs
 *
 * @property logger
 * @type log4js/app
 * 
 */
var logger = require('log4js').getLogger("app");


/**
 * My method description.  Like other pieces of your comment blocks, 
 * this can span multiple lines.
 * ROUTE CALL:  /
 *
 * @method getclusters
 * 
 * @param {String} foo Argument 1
 * @param {Object} config A config object
 * @param {String} config.name The name on the config object
 * @param {Function} config.callback A callback function on the config object
 * @param {Boolean} [extra=false] Do extra, optional work
 * @return {Boolean} Returns true on success
 */
router.get('/', function (req, res)
{
    ClusterModel.getClusters(function (error, data)
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


/**
 * My method description.  Like other pieces of your comment blocks, 
 * this can span multiple lines.
 *
 * @method Newcluster
 * @param {String} foo Argument 1
 * @param {Object} config A config object
 * @return {Boolean} Returns true on success
 */
router.get('/cluster', function (req, res)
{
    res.render('new_cluster', {title: 'Servicio rest con nodejs, express 4 and mysql'});
});

/* New cluster */
router.post("/cluster", function (req, res)
{
    //new objet with Cluster data
    var clusterData = {
        id: null,
        name: req.body.name
    };
    ClusterModel.insertCluster(clusterData, function (error, data)
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

/* cluster update */
router.put('/cluster/', function (req, res)
{
    //Save cluster data into objet 
    var clusterData = {id: req.param('id'), name: req.param('name')};
    ClusterModel.updateCluster(clusterData, function (error, data)
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
router.get('/cluster/:id', function (req, res)
{
    var id = req.params.id;

    if (!isNaN(id))
    {
        ClusterModel.getCluster(id, function (error, data)
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
router.delete("/cluster/", function (req, res)
{

    var id = req.param('id');
    ClusterModel.deleteCluster(id, function (error, data)
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