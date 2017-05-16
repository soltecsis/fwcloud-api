var express = require('express');
var router = express.Router();
var Routing_positionModel = require('../models/routing_position');

var isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.redirect('/');
};

router.get('/*',isAuthenticated, function (req, res, next){
    return next();
});

/* Mostramos el formulario para crear nuevos */
router.get('/routing-position', function (req, res)
{
    res.render('new_routing_position', {title: 'Crear nuevo routing_position'});
});

/* Obtenemos y mostramos todos los routing_positions*/
router.get('/', function (req, res)
{

    Routing_positionModel.getRouting_positions(function (error, data)
    {
        //si existe el routing_position mostramos el formulario
        if (typeof data !== 'undefined')
        {
            res.json(200, data);
        }
        //en otro caso mostramos un error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});



/* Obtenemos y mostramos  routing_position por id */
router.get('/:id', function (req, res)
{    
    var id = req.params.id;
    Routing_positionModel.getRouting_position(id,function (error, data)
    {
        //si existe el routing_position mostramos el formulario
        if (typeof data !== 'undefined')
        {
            res.json(200, data);
        }
        //en otro caso mostramos un error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});

/* Obtenemos y mostramos todos los routing_positions por nombre */
router.get('/name/:name', function (req, res)
{
    var name = req.params.name;
    Routing_positionModel.getRouting_positionName(name,function (error, data)
    {
        //si existe el routing_position mostramos el formulario
        if (typeof data !== 'undefined')
        {
            res.json(200, data);
        }
        //en otro caso mostramos un error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});




/* Creamos un nuevo routing_position */
router.post("/routing-position", function (req, res)
{
    //creamos un objeto con los datos a insertar del routing_position
    var routing_positionData = {
        id: req.body.id,
        name: req.body.comment
    };
    
    Routing_positionModel.insertRouting_position(routing_positionData, function (error, data)
    {
        //si el routing_position se ha insertado correctamente mostramos su info
        if (data && data.insertId)
        {
            //res.redirect("/routing-positions/routing-position/" + data.insertId);
            res.json(200, {"insertId": data.insertId});
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Actualizamos un routing_position existente */
router.put('/routing-position/', function (req, res)
{
    //almacenamos los datos del formulario en un objeto
    var routing_positionData = {id: req.param('id'), name: req.param('name')};
    Routing_positionModel.updateRouting_position(routing_positionData, function (error, data)
    {
        //si el routing_position se ha actualizado correctamente mostramos un mensaje
        if (data && data.msg)
        {
            //res.redirect("/routing-positions/routing-position/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});



/* ELiminamos un routing_position */
router.delete("/routing-position/", function (req, res)
{
    //id del routing_position a eliminar
    var idfirewall = req.param('idfirewall');
    var id = req.param('id');
    Routing_positionModel.deleteRouting_positionidfirewall(idfirewall,id, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/routing-positions/");
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

module.exports = router;