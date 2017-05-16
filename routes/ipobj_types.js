var express = require('express');
var router = express.Router();
var Ipobj_typeModel = require('../models/ipobj_type');

var isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.redirect('/');
};

router.get('/*',isAuthenticated, function (req, res, next){
    return next();
});

/* Mostramos el formulario para crear nuevos */
router.get('/ipobj-type', function (req, res)
{
    res.render('new_ipobj_type', {title: 'Crear nuevo ipobj_type'});
});

/* Obtenemos y mostramos todos los ipobj_types*/
router.get('/', function (req, res)
{

    Ipobj_typeModel.getIpobj_types(function (error, data)
    {
        //si existe el ipobj_type mostramos el formulario
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



/* Obtenemos y mostramos  ipobj_type por id */
router.get('/:id', function (req, res)
{    
    var id = req.params.id;
    Ipobj_typeModel.getIpobj_type(id,function (error, data)
    {
        //si existe el ipobj_type mostramos el formulario
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

/* Obtenemos y mostramos todos los ipobj_types por nombre */
router.get('/name/:name', function (req, res)
{
    var name = req.params.name;
    Ipobj_typeModel.getIpobj_typeName(name,function (error, data)
    {
        //si existe el ipobj_type mostramos el formulario
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




/* Creamos un nuevo ipobj_type */
router.post("/ipobj-type", function (req, res)
{
    //creamos un objeto con los datos a insertar del ipobj_type
    var ipobj_typeData = {
        id: req.body.id,
        type: req.body.type
    };
    
    Ipobj_typeModel.insertIpobj_type(ipobj_typeData, function (error, data)
    {
        //si el ipobj_type se ha insertado correctamente mostramos su info
        if (data && data.insertId)
        {
            //res.redirect("/ipobj-types/ipobj-type/" + data.insertId);
            res.json(200, {"insertId": data.insertId});
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Actualizamos un ipobj_type existente */
router.put('/ipobj-type/', function (req, res)
{
    //almacenamos los datos del formulario en un objeto
    var ipobj_typeData = {
        id: req.param('id'), 
        type: req.param('type')
    };
    Ipobj_typeModel.updateIpobj_type(ipobj_typeData, function (error, data)
    {
        //si el ipobj_type se ha actualizado correctamente mostramos un mensaje
        if (data && data.msg)
        {
            //res.redirect("/ipobj-types/ipobj-type/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});



/* ELiminamos un ipobj_type */
router.delete("/ipobj-type/", function (req, res)
{
    //id del ipobj_type a eliminar
    var id = req.param('id');
    Ipobj_typeModel.deleteIpobj_type(id, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/ipobj-types/");
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

module.exports = router;