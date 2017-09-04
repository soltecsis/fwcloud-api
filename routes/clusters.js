var express = require('express');
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
        if (typeof data !== 'undefined')
        {
//            res.render("show_clusters",{ 
//                title : "Mostrando listado de Clusters", 
//                clusters : data
//            });
            res.status(200).json( data);
        }
        //get error
        else
        {
            res.status(404).json( {"msg": "notExist"});
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
            //res.redirect("/clusters/cluster/" + data.insertId);
            res.status(200).json( {"insertId": data.insertId});
        } else
        {
            res.status(500).json( {"msg": error});
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
        if (data && data.msg)
        {
            //res.redirect("/clusters/cluster/" + req.param('id'));
            res.status(200).json( data.msg);
        } else
        {
            res.status(500).json( {"msg": error});
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
            if (typeof data !== 'undefined' && data.length > 0)
            {
//                res.render("update_cluster",{ 
//                    title : "", 
//                    info : data
//                });
                res.status(200).json( data);

            }
            //Get error
            else
            {
                res.status(404).json( {"msg": "notExist"});
            }
        });
    }
    
    else
    {
        res.status(500).json( {"msg": "The id must be numeric"});
    }
});



/* Remove cluster */
router.delete("/cluster/", function (req, res)
{
    
    var id = req.param('id');
    ClusterModel.deleteCluster(id, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/clusters/");
            res.status(200).json( data.msg);
        } else
        {
            res.status(500).json( {"msg": error});
        }
    });
});

module.exports = router;