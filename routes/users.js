var express = require('express');
var router = express.Router();
var UserModel = require('../models/user');

/*
var isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.redirect('/');
};

router.get('/*',isAuthenticated, function (req, res, next){
    return next();
});
*/

/* Mostramos el formulario para crear usuarios nuevos */
//router.get('/', function(req, res) 
//{
//  res.render('index', { title: 'Mostrando listado de Users'});
//});

/* Obtenemos y mostramos todos los users por customer*/
router.get('/:customer', function (req, res)
{
    var customer=req.params.customer;
    UserModel.getUsers(customer,function (error, data)
    {
        //si existe el user mostramos el formulario
        if (typeof data !== 'undefined')
        {
//            res.render("show_users",{ 
//                title : "Mostrando listado de Users", 
//                users : data
//            });
            res.json(200, {"data": data});
        }
        //en otro caso mostramos un error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});

/* Obtenemos y mostramos todos los users por customer y username*/
router.get('/:customer/username/:username', function (req, res)
{
    var customer=req.params.customer;
    var username=req.params.username;
    UserModel.getUserName(customer, username, function (error, data)
    {
        //si existe el user mostramos el formulario
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

/* Mostramos el formulario para crear usuarios nuevos */
router.get('/user', function (req, res)
{
    res.render('new_user', {title: 'Servicio rest con nodejs, express 4 y mysql'});
});

/* Creamos un nuevo user */
router.post("/user", function (req, res)
{
    //creamos un objeto con los datos a insertar del user
    var userData = {
        id: null,
        customer: req.body.customer,
        username: req.body.username,
        allowed_ip: req.body.allowed_ip,
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,        
        role: req.body.role        
    };
    UserModel.insertUser(userData, function (error, data)
    {
        //si el user se ha insertado correctamente mostramos su info
        if (data && data.insertId)
        {
            //res.redirect("/users/user/" + data.insertId);
            res.json(200, {"insertId": data.insertId});
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Actualizamos un user existente */
router.put('/user/', function (req, res)
{
    //almacenamos los datos del formulario en un objeto
    var userData = {id: req.param('id'), customer: req.param('customer'), username: req.param('username'), allowed_ip: req.param('allowed_ip'), name: req.param('name'), email: req.param('email'), password: req.param('password'), role: req.param('role')};
    UserModel.updateUser(userData, function (error, data)
    {
        //si el user se ha actualizado correctamente mostramos un mensaje
        if (data && data.msg)
        {
            //res.redirect("/users/user/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Obtenemos un user por su id y lo mostramos en un formulario para editar */
router.get('/:customer/user/:id', function (req, res)
{
     var customer=req.params.customer;
    var id = req.params.id;
    //solo actualizamos si la id es un número
    if (!isNaN(id))
    {
        UserModel.getUser(customer,id, function (error, data)
        {
            //si existe el user mostramos el formulario
            if (typeof data !== 'undefined' && data.length > 0)
            {
                //res.render("update_user",{ 
                //    title : "Servicio rest con nodejs, express 4 y mysql", 
                //    info : data
                //});
                res.json(200, {"data": data});

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




/* ELiminamos un user */
router.delete("/user/", function (req, res)
{
    //id del user a eliminar
    var id = req.param('id');
    UserModel.deleteUser(id, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/users/");
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

module.exports = router;