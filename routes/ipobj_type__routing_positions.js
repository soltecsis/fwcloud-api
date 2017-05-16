var express = require('express');
var router = express.Router();
var Ipobj_type__routing_positionModel = require('../models/ipobj_type__routing_position');

var isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.redirect('/');
};

router.get('/*',isAuthenticated, function (req, res, next){
    return next();
});

/* Mostramos el formulario para crear nuevos */
router.get('/ipobj-type__routing-position', function (req, res)
{
    res.render('new_ipobj_type__routing_position', {title: 'Crear nuevo ipobj_type__routing_position'});
});

/* Obtenemos y mostramos todos los ipobj_type__routing_positions*/
router.get('/', function (req, res)
{

    Ipobj_type__routing_positionModel.getIpobj_type__routing_positions(function (error, data)
    {
        //si existe el ipobj_type__routing_position mostramos el formulario
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



/* Obtenemos y mostramos  ipobj_type__routing_position por id */
router.get('/:type/:position', function (req, res)
{    
    var type = req.params.type;
    var position = req.params.position;
    
    Ipobj_type__routing_positionModel.getIpobj_type__routing_position(type, position,function (error, data)
    {
        //si existe el ipobj_type__routing_position mostramos el formulario
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



/* Creamos un nuevo ipobj_type__routing_position */
router.post("/ipobj-type__routing-position", function (req, res)
{
    //creamos un objeto con los datos a insertar del ipobj_type__routing_position
    var ipobj_type__routing_positionData = {
        type: req.body.type,
        position: req.body.position,
        allowed: req.body.allowed
    };
    
    Ipobj_type__routing_positionModel.insertIpobj_type__routing_position(ipobj_type__routing_positionData, function (error, data)
    {
        //si el ipobj_type__routing_position se ha insertado correctamente mostramos su info
        if (data && data.insertId)
        {
            //res.redirect("/ipobj-type__routing-positions/ipobj-type__routing-position/" + data.insertId);
            res.json(200, {"insertId": data.insertId});
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Actualizamos un ipobj_type__routing_position existente */
router.put('/ipobj-type__routing-position/', function (req, res)
{
    //almacenamos los datos del formulario en un objeto
    var ipobj_type__routing_positionData = {        
        type: req.param('type'),
        position: req.param('position'),
        allowed: req.param('allowed')
    };
    Ipobj_type__routing_positionModel.updateIpobj_type__routing_position(ipobj_type__routing_positionData, function (error, data)
    {
        //si el ipobj_type__routing_position se ha actualizado correctamente mostramos un mensaje
        if (data && data.msg)
        {
            //res.redirect("/ipobj-type__routing-positions/ipobj-type__routing-position/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});



/* ELiminamos un ipobj_type__routing_position */
router.delete("/ipobj-type__routing-position/", function (req, res)
{
    //id del ipobj_type__routing_position a eliminar
    var type = req.params.type;
    var position = req.params.position;
    
    Ipobj_type__routing_positionModel.deleteIpobj_type__routing_position(type, position, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/ipobj-type__routing-positions/");
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

module.exports = router;