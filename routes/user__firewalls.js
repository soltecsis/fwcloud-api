var express = require('express');
var router = express.Router();
var User__firewallModel = require('../models/user__firewall');

var isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.redirect('/');
};

router.get('/*',isAuthenticated, function (req, res, next){
    return next();
});

/* Mostramos el formulario para crear usuarios nuevos */
//router.get('/', function(req, res) 
//{
//  res.render('index', { title: 'Mostrando listado de User__firewalls'});
//});

/* Obtenemos y mostramos todos los user__firewalls de usuario */
router.get('/:id_user', function (req, res)
{
    var id_user = req.params.id_user;
    User__firewallModel.getUser__firewalls(id_user, function (error, data)
    {
        //si existe el user__firewall mostramos el formulario
        if (typeof data !== 'undefined')
        {
//            res.render("show_user__firewalls",{ 
//                title : "Mostrando listado de User__firewalls", 
//                user__firewalls : data
//            });
            res.json(200, data);
        }
        //en otro caso mostramos un error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});

/* Obtenemos un user__firewall por su id  */
router.get('/user__firewall/:id_user/:id_firewall', function (req, res)
{
    var id_user = req.params.id_user;
    var id_firewall = req.params.id_firewall;
    //solo actualizamos si la id es un número
    if (!isNaN(id_user))
    {
        User__firewallModel.getUser__firewall(id_user, id_firewall, function (error, data)
        {
            //si existe el user__firewall mostramos el formulario
            if (typeof data !== 'undefined' && data.length > 0)
            {
//                res.render("update_user__firewall",{ 
//                    title : "Servicio rest con nodejs, express 4 y mysql", 
//                    info : data
//                });
                res.json(200, data);

            }
            //en otro caso mostramos un error
            else
            {
                res.json(404, {"msg": "notExist"});
            }
        });
    }
    //si la id no es numerica mostramos un error de servidor
    else
    {
        res.json(500, {"msg": "The id must be numeric"});
    }
});



/* Mostramos el formulario para crear usuarios nuevos */
router.get('/user__firewall', function (req, res)
{
    res.render('new_user__firewall', {title: 'Servicio rest con nodejs, express 4 y mysql'});
});

/* Creamos un nuevo user__firewall */
router.post("/user__firewall", function (req, res)
{
    //creamos un objeto con los datos a insertar del user__firewall
    var user__firewallData = {
        id_user: req.body.id_user,
        id_firewall: req.body.id_firewall
    };
    User__firewallModel.insertUser__firewall(user__firewallData, function (error, data)
    {
        //si el user__firewall se ha insertado correctamente mostramos su info
        if (data && data.insertId)
        {
            //res.redirect("/user__firewalls/user__firewall/" + data.insertId);
            res.json(200, {"insertId": data.insertId});
        } else
        {
            res.json(500, data.error);
        }
    });
});

/* Actualizamos un user__firewall existente */
router.put('/user__firewall/', function (req, res)
{
    //almacenamos los datos del formulario en un objeto
    var user__firewallData = {id_user: req.param('id_user'), id_firewall: req.param('id_firewall')};
    User__firewallModel.updateUser__firewall(user__firewallData, function (error, data)
    {
        //si el user__firewall se ha actualizado correctamente mostramos un mensaje
        if (data && data.msg)
        {
            //res.redirect("/user__firewalls/user__firewall/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, data.error);
        }
    });
});



/* ELiminamos un user__firewall */
router.delete("/user__firewall/", function (req, res)
{
    var id_user = req.params.id_user;
    var id_firewall = req.params.id_firewall;
    User__firewallModel.deleteUser__firewall(id_user, id_firewall, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/user__firewalls/");
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"error": error});
        }
    });
});

module.exports = router;