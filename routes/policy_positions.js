var express = require('express');
var router = express.Router();
var Policy_positionModel = require('../models/policy_position');

var isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.redirect('/');
};

//router.get('/*',isAuthenticated, function (req, res, next){
//    return next();
//});

/* Mostramos el formulario para crear nuevos */
router.get('/policy-position', function (req, res)
{
    res.render('new_policy_position', {title: 'Crear nuevo policy_position'});
});

/* Obtenemos y mostramos todos los policy_positions*/
router.get('/', function (req, res)
{

    Policy_positionModel.getPolicy_positions(function (error, data)
    {
        //si existe el policy_position mostramos el formulario
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



/* Obtenemos y mostramos  policy_position por id */
router.get('/:id', function (req, res)
{    
    var id = req.params.id;
    Policy_positionModel.getPolicy_position(id,function (error, data)
    {
        //si existe el policy_position mostramos el formulario
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

/* Obtenemos y mostramos todos los policy_positions por nombre */
router.get('/name/:name', function (req, res)
{
    var name = req.params.name;
    Policy_positionModel.getPolicy_positionName(name,function (error, data)
    {
        //si existe el policy_position mostramos el formulario
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




/* Creamos un nuevo policy_position */
router.post("/policy-position", function (req, res)
{
    //creamos un objeto con los datos a insertar del policy_position
    var policy_positionData = {
        id: req.body.id,
        name: req.body.comment
    };
    
    Policy_positionModel.insertPolicy_position(policy_positionData, function (error, data)
    {
        //si el policy_position se ha insertado correctamente mostramos su info
        if (data && data.insertId)
        {
            //res.redirect("/policy-positions/policy-position/" + data.insertId);
            res.json(200, {"insertId": data.insertId});
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Actualizamos un policy_position existente */
router.put('/policy-position/', function (req, res)
{
    //almacenamos los datos del formulario en un objeto
    var policy_positionData = {id: req.param('id'), name: req.param('name')};
    Policy_positionModel.updatePolicy_position(policy_positionData, function (error, data)
    {
        //si el policy_position se ha actualizado correctamente mostramos un mensaje
        if (data && data.msg)
        {
            //res.redirect("/policy-positions/policy-position/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});



/* ELiminamos un policy_position */
router.delete("/policy-position/", function (req, res)
{
    //id del policy_position a eliminar
    var idfirewall = req.param('idfirewall');
    var id = req.param('id');
    Policy_positionModel.deletePolicy_positionidfirewall(idfirewall,id, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/policy-positions/");
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

module.exports = router;