var express = require('express');
var router = express.Router();
var Routing_rModel = require('../models/routing_r');

var isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.redirect('/');
};

router.get('/*',isAuthenticated, function (req, res, next){
    return next();
});

/* Mostramos el formulario para crear usuarios nuevos */
router.get('/routing-r', function (req, res)
{
    res.render('new_routing_r', {title: 'Crear nuevo routing_r'});
});

/* Obtenemos y mostramos todos los routing_rs por firewall y grupo*/
router.get('/:idfirewall/group/:idgroup', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var idgroup = req.params.idgroup;
    Routing_rModel.getRouting_rs(idfirewall,idgroup,function (error, data)
    {
        //si existe el routing_r mostramos el formulario
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
/* Obtenemos y mostramos todos los routing_rs por firewall */
router.get('/:idfirewall', function (req, res)
{
    var idfirewall = req.params.idfirewall;    
    Routing_rModel.getRouting_rs(idfirewall,'',function (error, data)
    {
        //si existe el routing_r mostramos el formulario
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

/* Obtenemos y mostramos  routing_r por id y  por firewall y grupo */
router.get('/:idfirewall/:id', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var id = req.params.id;
    Routing_rModel.getRouting_r(idfirewall,id,function (error, data)
    {
        //si existe el routing_r mostramos el formulario
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

/* Obtenemos y mostramos todos los routing_rs por nombre y por firewall*/
router.get('/:idfirewall/:idgroup/name/:name', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var name = req.params.name;
    var idgroup = req.params.idgroup;
    Routing_rModel.getRouting_rName(idfirewall,idgroup,name,function (error, data)
    {
        //si existe el routing_r mostramos el formulario
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





/* Creamos un nuevo routing_r */
router.post("/routing-r", function (req, res)
{
    //creamos un objeto con los datos a insertar del routing_r
    var routing_rData = {
        id: null,
        idgroup: req.body.idgroup,
        firewall: req.body.firewall,
        rule_order: req.body.rule_order,        
        metric: req.body.metric,
        options: req.body.options,
        comment: req.body.comment
    };
    
    Routing_rModel.insertRouting_r(routing_rData, function (error, data)
    {
        //si el routing_r se ha insertado correctamente mostramos su info
        if (data && data.insertId)
        {
            //res.redirect("/routing-rs/routing-r/" + data.insertId);
            res.json(200, {"insertId": data.insertId});
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Actualizamos un routing_r existente */
router.put('/routing-r/', function (req, res)
{
    //almacenamos los datos del formulario en un objeto
    var routing_rData = {id: req.param('id'), idgroup: req.param('idgroup'), firewall: req.param('firewall'), rule_order: req.param('rule_order'),  options: req.param('options'), metric: req.param('metric'), comment: req.param('comment')};
    Routing_rModel.updateRouting_r(routing_rData, function (error, data)
    {
        //si el routing_r se ha actualizado correctamente mostramos un mensaje
        if (data && data.msg)
        {
            //res.redirect("/routing-rs/routing-r/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});



/* ELiminamos un routing_r */
router.delete("/routing-r/", function (req, res)
{
    //id del routing_r a eliminar
    var idfirewall = req.param('idfirewall');
    var id = req.param('id');
    Routing_rModel.deleteRouting_r(idfirewall,id, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/routing-rs/");
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

module.exports = router;