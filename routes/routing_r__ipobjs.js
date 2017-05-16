var express = require('express');
var router = express.Router();
var Routing_r__ipobjModel = require('../models/routing_r__ipobj');

var isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.redirect('/');
};

router.get('/*',isAuthenticated, function (req, res, next){
    return next();
});

/* Mostramos el formulario para crear usuarios nuevos */
router.get('/routing-r__ipobj', function (req, res)
{
    res.render('new_routing_r__ipobj', {title: 'Crear nuevo routing_r__ipobj'});
});

/* Obtenemos y mostramos todos los routing_r__ipobjs por rule*/

router.get('/:rule', function (req, res)
{
    var rule = req.params.rule;
    
    Routing_r__ipobjModel.getRouting_r__ipobjs(rule,function (error, data)
    {
        //si existe el routing_r__ipobj mostramos el formulario
        if (typeof data !== 'undefined' && data.length>0)
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

/* Obtenemos y mostramos todos los routing_r__ipobjs por rule y posicion*/

router.get('/:rule/:position', function (req, res)
{
    var rule = req.params.rule;
    var position = req.params.position;
    
    Routing_r__ipobjModel.getRouting_r__ipobjs_position(rule,position,function (error, data)
    {
        //si existe el routing_r__ipobj mostramos el formulario
        if (typeof data !== 'undefined' && data.length>0)
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


/* Obtenemos y mostramos  routing_r__ipobj por id  */

router.get('/:rule/:ipobj/:ipobj_g/:position', function (req, res)
{
    var rule = req.params.rule;
    var ipobj = req.params.ipobj;
    var ipobj_g = req.params.ipobj_g;
    var position = req.params.position;
    Routing_r__ipobjModel.getRouting_r__ipobj(rule,ipobj,ipobj_g,position,function (error, data)
    {
        //si existe el routing_r__ipobj mostramos el formulario
        if (typeof data !== 'undefined' && data.length>0)
        {
            res.render("update_routing_r__ipobj",{ 
                    title : "FWBUILDER", 
                    info : data
                });            
            //res.json(200, data);
        }
        //en otro caso mostramos un error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});



/* Creamos un nuevo routing_r__ipobj */
router.post("/routing-r__ipobj", function (req, res)
{
    //creamos un objeto con los datos a insertar del routing_r__ipobj
    var routing_r__ipobjData = {
        rule: req.body.rule,
        ipobj: req.body.ipobj,
        ipobj_g: req.body.ipobj_g,
        position: req.body.position,
        position_order: req.body.position_order
    };
    
    Routing_r__ipobjModel.insertRouting_r__ipobj(routing_r__ipobjData, function (error, data)
    {
        //si el routing_r__ipobj se ha insertado correctamente mostramos su info
        if (data && data.msg)
        {
            //res.redirect("/routing-r__ipobjs/routing-r__ipobj/" + data.insertId);
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"error": error});
        }
    });
});

/* Actualizamos un routing_r__ipobj existente */
router.put('/routing-r__ipobj', function (req, res)
{
    var rule = req.body.get_rule;
    var ipobj = req.body.get_ipobj;
    var ipobj_g = req.body.get_ipobj_g;
    var position = req.body.get_position;
    var position_order = req.body.get_position_order;
    
    //almacenamos los datos del formulario en un objeto
    var routing_r__ipobjData = {
        rule: req.body.rule,
        ipobj: req.body.ipobj,
        ipobj_g: req.body.ipobj_g,
        position: req.body.position,
        position_order: req.body.position_order
    };
    Routing_r__ipobjModel.updateRouting_r__ipobj(rule,ipobj,ipobj_g,position, position_order,routing_r__ipobjData, function (error, data)
    {
        //si el routing_r__ipobj se ha actualizado correctamente mostramos un mensaje
        if (data && data.msg)
        {
            //res.redirect("/routing-r__ipobjs/routing-r__ipobj/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Actualizamos un POSITION routing_r__ipobj existente */
router.put('/routing-r__ipobj/:rule/:ipobj/:ipobj_g/:position/:position_order/:new_position/:new_order', function (req, res)
{
    var rule = req.params.rule;
    var ipobj = req.params.ipobj;
    var ipobj_g = req.params.ipobj_g;
    var position = req.params.position;
    var position_order = req.params.position_order;
    var new_position = req.params.new_position;
    var new_order = req.params.new_order;
    

    Routing_r__ipobjModel.updateRouting_r__ipobj_position(rule,ipobj,ipobj_g,position,position_order,new_position,new_order, function (error, data)
    {
        //si el routing_r__ipobj se ha actualizado correctamente mostramos un mensaje
        if (data && data.msg)
        {
            //res.redirect("/routing-r__ipobjs/routing-r__ipobj/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Actualizamos un ORDER routing_r__ipobj existente */
router.put('/routing-r__ipobj/:rule/:ipobj/:ipobj_g/:position/:position_order/:new_order', function (req, res)
{
    var rule = req.params.rule;
    var ipobj = req.params.ipobj;
    var ipobj_g = req.params.ipobj_g;
    var position = req.params.position;
    var position_order = req.params.position_order;
    var new_order = req.params.new_order;
    
    

    Routing_r__ipobjModel.updateRouting_r__ipobj_position_order(rule,ipobj,ipobj_g,position,position_order,new_order, function (error, data)
    {
        //si el routing_r__ipobj se ha actualizado correctamente mostramos un mensaje
        if (data && data.msg)
        {
            //res.redirect("/routing-r__ipobjs/routing-r__ipobj/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});




/* ELiminamos un routing_r__ipobj */
router.delete("/routing-r__ipobj/", function (req, res)
{
    //id del routing_r__ipobj a eliminar
    var rule = req.body.rule;
    var ipobj = req.body.ipobj;
    var ipobj_g = req.body.ipobj_g;
    var position = req.body.position;
    var position_order = req.body.position_order;
    
    Routing_r__ipobjModel.deleteRouting_r__ipobj(rule,ipobj,ipobj_g,position, position_order, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/routing-r__ipobjs/");
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

module.exports = router;