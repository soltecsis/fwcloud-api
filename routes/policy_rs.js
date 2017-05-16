var express = require('express');
var router = express.Router();
var Policy_rModel = require('../models/policy_r');

var logger = require('log4js').getLogger("app");

var isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.redirect('/');
};

//router.get('/*',isAuthenticated, function (req, res, next){
//    return next();
//});

/* Mostramos el formulario para crear usuarios nuevos */
router.get('/policy-r', function (req, res)
{
    res.render('new_policy_r', {title: 'Crear nuevo policy_r'});
});

/* Obtenemos y mostramos todos los policy_rs por firewall y grupo*/
router.get('/:idfirewall/group/:idgroup', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var idgroup = req.params.idgroup;
    Policy_rModel.getPolicy_rs(idfirewall,idgroup,function (error, data)
    {
        //si existe el policy_r mostramos el formulario
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
/* Obtenemos y mostramos todos los policy_rs por firewall */
router.get('/:idfirewall', function (req, res)
{
    var idfirewall = req.params.idfirewall;    
    logger.debug("MOSTRANDO POLICY para firewall: " + idfirewall);
    Policy_rModel.getPolicy_rs(idfirewall,'',function (error, data)
    {
        //si existe el policy_r mostramos el formulario
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

/* Obtenemos y mostramos  policy_r por id y  por firewall y grupo */
router.get('/:idfirewall/:id', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var id = req.params.id;
    
    Policy_rModel.getPolicy_r(idfirewall,id,function (error, data)
    {
        //si existe el policy_r mostramos el formulario
        if (typeof data !== 'undefined')
        {
//            res.render("update_policy_r",{ 
//                    title : "FWBUILDER", 
//                    info : data
//                });  
            res.json(200, {"data": data});
        }
        //en otro caso mostramos un error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});

/* Obtenemos y mostramos todos los policy_rs por nombre y por firewall*/
router.get('/:idfirewall/:idgroup/name/:name', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var name = req.params.name;
    var idgroup = req.params.idgroup;
    Policy_rModel.getPolicy_rName(idfirewall,idgroup,name,function (error, data)
    {
        //si existe el policy_r mostramos el formulario
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





/* Creamos un nuevo policy_r */
router.post("/policy-r", function (req, res)
{
    //creamos un objeto con los datos a insertar del policy_r
    var policy_rData = {
        id: null,
        idgroup: req.body.idgroup,
        firewall: req.body.firewall,        
        rule_order: req.body.rule_order,        
        direction: req.body.direction,
        action: req.body.action,
        time_start: req.body.time_start,
        time_end: req.body.time_end,
        active: req.body.active,
        options: req.body.options,
        comment: req.body.comment,
        type: req.body.type,
        interface_negate: req.body.interface_negate
    };
    
    Policy_rModel.insertPolicy_r(policy_rData, function (error, data)
    {
        //si el policy_r se ha insertado correctamente mostramos su info
        if (data && data.insertId)
        {
            //res.redirect("/policy-rs/policy-r/" + data.insertId);
            res.json(200, {"insertId": data.insertId});
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Actualizamos un policy_r existente */
router.put('/policy-r/', function (req, res)
{
    //almacenamos los datos del formulario en un objeto
    var policy_rData = {id: req.param('id'), idgroup: req.param('idgroup'), firewall: req.param('firewall'),  rule_order: req.param('rule_order'),  direction: req.param('direction'), options: req.param('options'), action: req.param('action'), time_start: req.param('time_start'), time_end: req.param('time_end'), comment: req.param('comment'), active: req.param('active'), type: req.param('type'), interface_negate: req.param('interface_negate')};
    var old_order=req.param('old_order');
    Policy_rModel.updatePolicy_r(old_order,policy_rData, function (error, data)
    {
        //si el policy_r se ha actualizado correctamente mostramos un mensaje
        if (data && data.msg)
        {
            //res.redirect("/policy-rs/policy-r/" + req.param('id'));
            res.json(200, {"data": data}.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Actualizamos ORDER de un policy_r existente */
router.put('/policy-r/', function (req, res)
{
    //almacenamos los datos del formulario en un objeto
    var idfirewall = req.param('idfirewall');
    var id = req.param('id');
    var rule_order = req.param('rule_order');    
    var old_order=req.param('old_order');
    
    Policy_rModel.updatePolicy_r_order(idfirewall,id, rule_order, old_order, function (error, data)
    {
        //si el policy_r se ha actualizado correctamente mostramos un mensaje
        if (data && data.msg)
        {
            //res.redirect("/policy-rs/policy-r/" + req.param('id'));
            res.json(200, {"data": data}.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});



/* ELiminamos un policy_r */
router.delete("/policy-r/", function (req, res)
{
    //id del policy_r a eliminar
    var idfirewall = req.param('idfirewall');
    var id = req.param('id');
    var rule_order = req.param('rule_order');
    Policy_rModel.deletePolicy_r(idfirewall,id, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/policy-rs/");
            res.json(200, {"data": data}.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

module.exports = router;