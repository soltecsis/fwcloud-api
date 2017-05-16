var express = require('express');
var router = express.Router();
var Ipobj_gModel = require('../models/ipobj_g');

var isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.redirect('/');
};

router.get('/*',isAuthenticated, function (req, res, next){
    return next();
});

/* Mostramos el formulario para crear nuevos */
router.get('/ipobj-g', function (req, res)
{
    res.render('new_ipobj_g', {title: 'Crear nuevo ipobj_g'});
});

/* Obtenemos y mostramos todos los ipobj_gs*/
router.get('/:fwcloud', function (req, res)
{
    var fwcloud = req.params.fwcloud;
    Ipobj_gModel.getIpobj_gs(fwcloud,function (error, data)
    {
        //si existe el ipobj_g mostramos el formulario
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




/* Obtenemos y mostramos  ipobj_g por id */
router.get('/:fwcloud/:id', function (req, res)
{    
    var id = req.params.id;
    var fwcloud = req.params.fwcloud;
    Ipobj_gModel.getIpobj_g(fwcloud,id,function (error, data)
    {
        //si existe el ipobj_g mostramos el formulario
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

/* Obtenemos y mostramos todos los ipobj_gs por nombre */
router.get('/:fwcloud/name/:name', function (req, res)
{
    var name = req.params.name;
    var fwcloud = req.params.fwcloud;
    Ipobj_gModel.getIpobj_gName(fwcloud,name,function (error, data)
    {
        //si existe el ipobj_g mostramos el formulario
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

/* Obtenemos y mostramos todos los ipobj_gs por tipo */
router.get('/:fwcloud/type/:type', function (req, res)
{
    var type = req.params.type;
    var fwcloud = req.params.fwcloud;
    Ipobj_gModel.getIpobj_gtype(fwcloud,type,function (error, data)
    {
        //si existe el ipobj_g mostramos el formulario
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





/* Creamos un nuevo ipobj_g */
router.post("/ipobj-g", function (req, res)
{
    //creamos un objeto con los datos a insertar del ipobj_g
    var ipobj_gData = {
        id: null,
        name: req.body.name,
        type: req.body.comment,
        fwcloud: req.body.fwcloud
    };
    
    Ipobj_gModel.insertIpobj_g(ipobj_gData, function (error, data)
    {
        //si el ipobj_g se ha insertado correctamente mostramos su info
        if (data && data.insertId)
        {
            //res.redirect("/ipobj-gs/ipobj-g/" + data.insertId);
            res.json(200, {"insertId": data.insertId});
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Actualizamos un ipobj_g existente */
router.put('/ipobj-g/', function (req, res)
{
    //almacenamos los datos del formulario en un objeto
    var ipobj_gData = {id: req.param('id'), name: req.param('name'), firewall: req.param('firewall'), comment: req.param('comment'),fwcloud: req.param('fwcloud')};
    Ipobj_gModel.updateIpobj_g(ipobj_gData, function (error, data)
    {
        //si el ipobj_g se ha actualizado correctamente mostramos un mensaje
        if (data && data.msg)
        {
            //res.redirect("/ipobj-gs/ipobj-g/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});



/* ELiminamos un ipobj_g */
router.delete("/ipobj-g/", function (req, res)
{
    //id del ipobj_g a eliminar
    var idfirewall = req.param('idfirewall');
    var id = req.param('id');
    Ipobj_gModel.deleteIpobj_gidfirewall(idfirewall,id, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/ipobj-gs/");
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

module.exports = router;