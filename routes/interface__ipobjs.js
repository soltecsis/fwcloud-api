var express = require('express');
var router = express.Router();
var Interface__ipobjModel = require('../models/interface__ipobj');

var isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.redirect('/');
};

router.get('/*',isAuthenticated, function (req, res, next){
    return next();
});

/* Mostramos el formulario para crear usuarios nuevos */
router.get('/interface__ipobj', function (req, res)
{
    res.render('new_interface__ipobj', {title: 'Crear nuevo interface__ipobj'});
});

/* Obtenemos y mostramos todos los interface__ipobjs por interface*/
router.get('/interface/:interface', function (req, res)
{
    var interface = req.params.interface;
    Interface__ipobjModel.getInterface__ipobjs_interface(interface,function (error, data)
    {
        //si existe el interface__ipobj mostramos el formulario
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

/* Obtenemos y mostramos todos los interface__ipobjs por ipobj*/
router.get('/ipobj/:ipobj', function (req, res)
{
    var ipobj = req.params.ipobj;
    Interface__ipobjModel.getInterface__ipobjs_ipobj(ipobj,function (error, data)
    {
        //si existe el interface__ipobj mostramos el formulario
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

/* Obtenemos y mostramos  interface__ipobj por interface y ipobj*/
router.get('/interface__ipobj/:interface/:ipobj', function (req, res)
{
    var interface = req.params.interface;
    var ipobj = req.params.ipobj;
    Interface__ipobjModel.getInterface__ipobj(interface,ipobj,function (error, data)
    {
        //si existe el interface__ipobj mostramos el formulario
        if (typeof data !== 'undefined')
        {
             res.render("update_interface__ipobj",{ 
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



/* Creamos un nuevo interface__ipobj */
router.post("/interface__ipobj", function (req, res)
{
    //creamos un objeto con los datos a insertar del interface__ipobj
    var interface__ipobjData = {
        interface: req.body.interface,
        ipobj: req.body.ipobj,
        interface_order: req.body.interface_order
    };
    
    Interface__ipobjModel.insertInterface__ipobj(interface__ipobjData, function (error, data)
    {
        //si el interface__ipobj se ha insertado correctamente mostramos su info
        if (data && data.msg)
        {
            //res.redirect("/interface__ipobjs/interface__ipobj/" + data.insertId);
            res.json(200, {"msh": data.msg});
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Actualizamos un interface__ipobj existente */
router.put('/interface__ipobj/', function (req, res)
{
    //almacenamos los datos del formulario en un objeto
    var interface__ipobjData = {interface: req.param('interface'), ipobj: req.param('ipobj'), interface_order: req.param('interface_order')};
    var get_interface = req.param('get_interface');
    var get_ipobj = req.param('get_ipobj');
    var get_interface_order = req.param('get_interface_order');
    Interface__ipobjModel.updateInterface__ipobj(get_interface, get_ipobj, get_interface_order,interface__ipobjData, function (error, data)
    {
        //si el interface__ipobj se ha actualizado correctamente mostramos un mensaje
        if (data && data.msg)
        {
            //res.redirect("/interface__ipobjs/interface__ipobj/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});
/* Actualizamos ORDER un interface__ipobj existente */
router.put('/interface__ipobj/order/:new_order', function (req, res)
{
    var new_order = req.param('new_order');
    //almacenamos los datos del formulario en un objeto
    var interface__ipobjData = {interface: req.param('interface'), ipobj: req.param('ipobj'), interface_order: req.param('interface_order')};
    Interface__ipobjModel.updateInterface__ipobj_order(new_order,interface__ipobjData, function (error, data)
    {
        //si el interface__ipobj se ha actualizado correctamente mostramos un mensaje
        if (data && data.msg)
        {
            //res.redirect("/interface__ipobjs/interface__ipobj/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});



/* ELiminamos un interface__ipobj */
router.delete("/interface__ipobj/", function (req, res)
{
    //id del interface__ipobj a eliminar
    var interface = req.param('interface');
    var ipobj = req.param('ipobj');
    Interface__ipobjModel.deleteInterface__ipobjidfirewall(interface,ipobj, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/interface__ipobjs/");
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

module.exports = router;