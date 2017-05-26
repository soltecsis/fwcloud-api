var express = require('express');
var router = express.Router();
var ClusterModel = require('../models/cluster');

var isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.redirect('/');
};

router.get('/*',isAuthenticated, function (req, res, next){
    return next();
});

/* Mostramos el formulario para crear usuarios nuevos */
//router.get('/', function(req, res) 
//{
//  res.render('index', { title: 'Mostrando listado de Clusters'});
//});

/* Get all clusters */
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
            res.json(200, data);
        }
        //get error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});

/* New cluster form */
router.get('/cluster', function (req, res)
{
    res.render('new_cluster', {title: 'Servicio rest con nodejs, express 4 y mysql'});
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
            res.json(200, {"insertId": data.insertId});
        } else
        {
            res.json(500, {"msg": error});
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
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
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
                res.json(200, data);

            }
            //Get error
            else
            {
                res.json(404, {"msg": "notExist"});
            }
        });
    }
    
    else
    {
        res.json(500, {"msg": "The id must be numeric"});
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
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

module.exports = router;