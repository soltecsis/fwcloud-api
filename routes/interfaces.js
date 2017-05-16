var express = require('express');
var router = express.Router();
var InterfaceModel = require('../models/interface');

var isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.redirect('/');
};

//router.get('/*',isAuthenticated, function (req, res, next){
//    return next();
//});

/* Mostramos el formulario para crear usuarios nuevos */
router.get('/interface', function (req, res)
{
    res.render('new_interface', {title: 'Crear nuevo interface'});
});

/* Obtenemos y mostramos todos los interfaces por firewall*/
router.get('/:idfirewall', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    InterfaceModel.getInterfaces(idfirewall,function (error, data)
    {
        //si existe el interface mostramos el formulario
        if (typeof data !== 'undefined')
        {
            res.json(200, {"data": data});
        }
        //en otro caso mostramos un error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});

/* Obtenemos y mostramos  interface por id y  por firewall*/
router.get('/:idfirewall/interface/:id', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var id = req.params.id;
    InterfaceModel.getInterface(idfirewall,id,function (error, data)
    {
        //si existe el interface mostramos el formulario
        if (typeof data !== 'undefined')
        {
            res.json(200, {"data": data});
        }
        //en otro caso mostramos un error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});

/* Obtenemos y mostramos todos los interfaces por nombre y por firewall*/
router.get('/:idfirewall/name/:name', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var name = req.params.name;
    InterfaceModel.getInterfaceName(idfirewall,name,function (error, data)
    {
        //si existe el interface mostramos el formulario
        if (typeof data !== 'undefined')
        {
            res.json(200, {"data": data});
        }
        //en otro caso mostramos un error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});





/* Creamos un nuevo interface */
router.post("/interface", function (req, res)
{
    //creamos un objeto con los datos a insertar del interface
    var interfaceData = {
        id: null,
        firewall: req.body.firewall,
        name: req.body.name,
        labelName: req.body.labelName,
        type: req.body.type,
        securityLevel: req.body.securityLevel
    };
    
    InterfaceModel.insertInterface(interfaceData, function (error, data)
    {
        //si el interface se ha insertado correctamente mostramos su info
        if (data && data.insertId)
        {
            //res.redirect("/interfaces/interface/" + data.insertId);
            res.json(200, {"insertId": data.insertId});
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Actualizamos un interface existente */
router.put('/interface/', function (req, res)
{
    //almacenamos los datos del formulario en un objeto
    var interfaceData = {id: req.param('id'), name: req.param('name'), firewall: req.param('firewall'), labelName: req.param('labelName'), type: req.param('type'), securityLevel: req.param('securityLevel')};
    InterfaceModel.updateInterface(interfaceData, function (error, data)
    {
        //si el interface se ha actualizado correctamente mostramos un mensaje
        if (data && data.msg)
        {
            //res.redirect("/interfaces/interface/" + req.param('id'));
            res.json(200, {"data": data}.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});



/* ELiminamos un interface */
router.delete("/interface/", function (req, res)
{
    //id del interface a eliminar
    var idfirewall = req.param('idfirewall');
    var id = req.param('id');
    InterfaceModel.deleteInterfaceidfirewall(idfirewall,id, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/interfaces/");
            res.json(200, {"data": data}.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

module.exports = router;