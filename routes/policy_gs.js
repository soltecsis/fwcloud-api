var express = require('express');
var router = express.Router();
var Policy_gModel = require('../models/policy_g');

var isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.redirect('/');
};

router.get('/*',isAuthenticated, function (req, res, next){
    return next();
});

/* Mostramos el formulario para crear nuevos */
router.get('/policy-g', function (req, res)
{
    res.render('new_policy_g', {title: 'Crear nuevo policy_g'});
});

/* Obtenemos y mostramos todos los policy_gs por firewall*/
router.get('/:idfirewall', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    Policy_gModel.getPolicy_gs(idfirewall,function (error, data)
    {
        //si existe el policy_g mostramos el formulario
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

/* Obtenemos y mostramos todos los policy_gs por firewall y grupo padre*/
router.get('/:idfirewall/group/:idgroup', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var idgroup = req.params.idgroup;
    Policy_gModel.getPolicy_gs_group(idfirewall,idgroup,function (error, data)
    {
        //si existe el policy_g mostramos el formulario
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

/* Obtenemos y mostramos  policy_g por id y  por firewall*/
router.get('/:idfirewall/:id', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var id = req.params.id;
    Policy_gModel.getPolicy_g(idfirewall,id,function (error, data)
    {
        //si existe el policy_g mostramos el formulario
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

/* Obtenemos y mostramos todos los policy_gs por nombre y por firewall*/
router.get('/:idfirewall/name/:name', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var name = req.params.name;
    Policy_gModel.getPolicy_gName(idfirewall,name,function (error, data)
    {
        //si existe el policy_g mostramos el formulario
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





/* Creamos un nuevo policy_g */
router.post("/policy-g", function (req, res)
{
    //creamos un objeto con los datos a insertar del policy_g
    var policy_gData = {
        id: null,
        firewall: req.body.firewall,
        name: req.body.name,
        comment: req.body.comment
    };
    
    Policy_gModel.insertPolicy_g(policy_gData, function (error, data)
    {
        //si el policy_g se ha insertado correctamente mostramos su info
        if (data && data.insertId)
        {
            //res.redirect("/policy-gs/policy-g/" + data.insertId);
            res.json(200, {"insertId": data.insertId});
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Actualizamos un policy_g existente */
router.put('/policy-g/', function (req, res)
{
    //almacenamos los datos del formulario en un objeto
    var policy_gData = {id: req.param('id'), name: req.param('name'), firewall: req.param('firewall'), comment: req.param('comment')};
    Policy_gModel.updatePolicy_g(policy_gData, function (error, data)
    {
        //si el policy_g se ha actualizado correctamente mostramos un mensaje
        if (data && data.msg)
        {
            //res.redirect("/policy-gs/policy-g/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});



/* ELiminamos un policy_g */
router.delete("/policy-g/", function (req, res)
{
    //id del policy_g a eliminar
    var idfirewall = req.param('idfirewall');
    var id = req.param('id');
    Policy_gModel.deletePolicy_gidfirewall(idfirewall,id, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/policy-gs/");
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

module.exports = router;