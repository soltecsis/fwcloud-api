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

/* Obtenemos y mostramos todos los clusters */
router.get('/', function (req, res)
{
    ClusterModel.getClusters(function (error, data)
    {
        //si existe el cluster mostramos el formulario
        if (typeof data !== 'undefined')
        {
//            res.render("show_clusters",{ 
//                title : "Mostrando listado de Clusters", 
//                clusters : data
//            });
            res.json(200, data);
        }
        //en otro caso mostramos un error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});

/* Mostramos el formulario para crear usuarios nuevos */
router.get('/cluster', function (req, res)
{
    res.render('new_cluster', {title: 'Servicio rest con nodejs, express 4 y mysql'});
});

/* Creamos un nuevo cluster */
router.post("/cluster", function (req, res)
{
    //creamos un objeto con los datos a insertar del cluster
    var clusterData = {
        id: null,
        name: req.body.name
    };
    ClusterModel.insertCluster(clusterData, function (error, data)
    {
        //si el cluster se ha insertado correctamente mostramos su info
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

/* Actualizamos un cluster existente */
router.put('/cluster/', function (req, res)
{
    //almacenamos los datos del formulario en un objeto
    var clusterData = {id: req.param('id'), name: req.param('name')};
    ClusterModel.updateCluster(clusterData, function (error, data)
    {
        //si el cluster se ha actualizado correctamente mostramos un mensaje
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

/* Obtenemos un cluster por su id y lo mostramos en un formulario para editar */
router.get('/cluster/:id', function (req, res)
{
    var id = req.params.id;
    //solo actualizamos si la id es un número
    if (!isNaN(id))
    {
        ClusterModel.getCluster(id, function (error, data)
        {
            //si existe el cluster mostramos el formulario
            if (typeof data !== 'undefined' && data.length > 0)
            {
//                res.render("update_cluster",{ 
//                    title : "Servicio rest con nodejs, express 4 y mysql", 
//                    info : data
//                });
                res.json(200, data);

            }
            //en otro caso mostramos un error
            else
            {
                res.json(404, {"msg": "notExist"});
            }
        });
    }
    //si la id no es numerica mostramos un error de servidor
    else
    {
        res.json(500, {"msg": "The id must be numeric"});
    }
});



/* ELiminamos un cluster */
router.delete("/cluster/", function (req, res)
{
    //id del cluster a eliminar
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