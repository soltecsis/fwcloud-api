var express = require('express');
var router = express.Router();
var Policy_r__interfaceModel = require('../models/policy_r__interface');

var isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.redirect('/');
};

//router.get('/*',isAuthenticated, function (req, res, next){
//    return next();
//});

/* Mostramos el formulario para crear nuevos */
router.get('/policy-r__interface', function (req, res)
{
    res.render('new_policy_r__interface', {title: 'Crear nuevo policy_r__interface'});
});

/* Obtenemos y mostramos todos los IPOBJ de una interface*/
router.get('/:interface', function (req, res)
{
    var interface = req.params.interface;
    Policy_r__interfaceModel.getPolicy_r__interfaces_rule(interface,function (error, data)
    {
        //si existe el policy_r__interface mostramos el formulario
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

/* Obtenemos y mostramos todos los interface de un IPOBJ */
router.get('/:rule', function (req, res)
{
    var rule = req.params.rule;
    Policy_r__interfaceModel.getPolicy_r__interfaces_interface(rule,function (error, data)
    {
        //si existe el policy_r__interface mostramos el formulario
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



/* Obtenemos y mostramos  policy_r__interface por rule y interface */
router.get('/:interface/:rule', function (req, res)
{    
    var interface = req.params.interface;
    var rule = req.params.rule;
    
    Policy_r__interfaceModel.getPolicy_r__interface(interface, rule,function (error, data)
    {
        //si existe el policy_r__interface mostramos el formulario
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





/* Creamos un nuevo policy_r__interface */
router.post("/policy-r__interface", function (req, res)
{
    //creamos un objeto con los datos a insertar del policy_r__interface
    var policy_r__interfaceData = {
        rule: req.body.rule,
        interface: req.body.interface,
        interface_order: req.body.interface_order        
    };
    
    Policy_r__interfaceModel.insertPolicy_r__interface(policy_r__interfaceData, function (error, data)
    {
        //si el policy_r__interface se ha insertado correctamente mostramos su info
        if (data && data.msg)
        {
            //res.redirect("/policy-r__interfaces/policy-r__interface/" + data.insertId);
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"error": error});
        }
    });
});

/* Actualizamos un policy_r__interface existente */
router.put('/policy-r__interface', function (req, res)
{
    var old_order = req.body.get_column_order;
    //almacenamos los datos del formulario en un objeto
    var policy_r__interfaceData = {
        rule: req.body.rule, 
        interface: req.body.interface, 
        interface_order: req.body.interface_order        
    };
    Policy_r__interfaceModel.updatePolicy_r__interface(old_order,policy_r__interfaceData, function (error, data)
    {
        //si el policy_r__interface se ha actualizado correctamente mostramos un mensaje
        if (data && data.msg)
        {
            //res.redirect("/policy-r__interfaces/policy-r__interface/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"error": error});
        }
    });
});



/* Actualizamos ORDER de un policy_r__interface existente */
router.put('/policy-r__interface/:rule/:position/order/:old_order/:new_order', function (req, res)
{
    var rule = req.param('rule');
    var interface = req.param('interface');
    var old_order = req.param('old_order');
    var new_order = req.param('new_order');    

    Policy_r__interfaceModel.updatePolicy_r__interface_order(rule, interface,old_order,new_order, function (error, data)
    {
        //si el policy_r__interface se ha actualizado correctamente mostramos un mensaje
        if (data && data.msg)
        {
            //res.redirect("/policy-r__interfaces/policy-r__interface/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"error": error});
        }
    });
});



/* ELiminamos un policy_r__interface */
router.delete("/policy-r__interface/", function (req, res)
{
    //id del policy_r__interface a eliminar
    var rule = req.param('rule');
    var interface = req.param('interface');
    var old_order = req.param('old_order');
    
    Policy_r__interfaceModel.deletePolicy_r__interfaceidfirewall(rule, interface,old_order, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/policy-r__interfaces/");
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"error": error});
        }
    });
});

module.exports = router;