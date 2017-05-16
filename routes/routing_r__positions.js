var express = require('express');
var router = express.Router();
var Routing_r__positionModel = require('../models/routing_r__position');

var isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.redirect('/');
};

router.get('/*',isAuthenticated, function (req, res, next){
    return next();
});

/* Mostramos el formulario para crear nuevos */
router.get('/routing-r__position', function (req, res)
{
    res.render('new_routing_r__position', {title: 'Crear nuevo routing_r__position'});
});

/* Obtenemos y mostramos todos los routing_r__positions*/
router.get('/:rule', function (req, res)
{
    var rule = req.params.rule;
    Routing_r__positionModel.getRouting_r__positions(rule,function (error, data)
    {
        //si existe el routing_r__position mostramos el formulario
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



/* Obtenemos y mostramos  routing_r__position por rule y position */
router.get('/:rule/:position', function (req, res)
{    
    var rule = req.params.rule;
    var position = req.params.position;
    Routing_r__positionModel.getRouting_r__position(rule, position,function (error, data)
    {
        //si existe el routing_r__position mostramos el formulario
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





/* Creamos un nuevo routing_r__position */
router.post("/routing-r__position", function (req, res)
{
    //creamos un objeto con los datos a insertar del routing_r__position
    var routing_r__positionData = {
        rule: req.body.rule,
        position: req.body.position,
        column_order: req.body.column_order,
        negate: req.body.negate
    };
    
    Routing_r__positionModel.insertRouting_r__position(routing_r__positionData, function (error, data)
    {
        //si el routing_r__position se ha insertado correctamente mostramos su info
        if (data && data.msg)
        {
            //res.redirect("/routing-r__positions/routing-r__position/" + data.insertId);
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"error": error});
        }
    });
});

/* Actualizamos un routing_r__position existente */
router.put('/routing-r__position', function (req, res)
{
    var old_order = req.body.get_column_order;
    //almacenamos los datos del formulario en un objeto
    var routing_r__positionData = {
        rule: req.body.rule, 
        position: req.body.position, 
        column_order: req.body.column_order, 
        negate: req.body.negate
    };
    Routing_r__positionModel.updateRouting_r__position(old_order,routing_r__positionData, function (error, data)
    {
        //si el routing_r__position se ha actualizado correctamente mostramos un mensaje
        if (data && data.msg)
        {
            //res.redirect("/routing-r__positions/routing-r__position/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Actualizamos NEGATE de un routing_r__position existente */
router.put('/routing-r__position/:rule/:position/negate/:negate', function (req, res)
{
    var rule = req.param('rule');
    var position = req.param('position');
    var negate = req.param('negate');


    Routing_r__positionModel.updateRouting_r__position_negate(rule, position,negate, function (error, data)
    {
        //si el routing_r__position se ha actualizado correctamente mostramos un mensaje
        if (data && data.msg)
        {
            //res.redirect("/routing-r__positions/routing-r__position/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Actualizamos ORDER de un routing_r__position existente */
router.put('/routing-r__position/:rule/:position/order/:old_order/:new_order', function (req, res)
{
    var rule = req.param('rule');
    var position = req.param('position');
    var old_order = req.param('old_order');
    var new_order = req.param('new_order');    

    Routing_r__positionModel.updateRouting_r__position_order(rule, position,old_order,new_order, function (error, data)
    {
        //si el routing_r__position se ha actualizado correctamente mostramos un mensaje
        if (data && data.msg)
        {
            //res.redirect("/routing-r__positions/routing-r__position/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});



/* ELiminamos un routing_r__position */
router.delete("/routing-r__position/", function (req, res)
{
    //id del routing_r__position a eliminar
    var rule = req.param('rule');
    var position = req.param('position');
    var old_order = req.param('old_order');
    
    Routing_r__positionModel.deleteRouting_r__positionidfirewall(rule, position,old_order, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/routing-r__positions/");
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

module.exports = router;