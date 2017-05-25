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
        //show user form
        if (typeof data !== 'undefined')
        {
//            res.render("show_users",{ 
//                title : "Mostrando listado de Users", 
//                users : data
//            });
            res.json(200, {"data": data});
        }
        //other we show an error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});

/* Get all users from Custormer and username*/
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

/* form for new users */
router.get('/user', function (req, res)
{
    res.render('new_user', {title: 'Servicio rest con nodejs, express 4 y mysql'});
});

/* new user */
router.post("/user", function (req, res)
{
    //Objet to create new user
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
        //User created  ok
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

/* udate user */
router.put('/user/', function (req, res)
{
    //Save user data into objet
    var userData = {id: req.param('id'), customer: req.param('customer'), username: req.param('username'), allowed_ip: req.param('allowed_ip'), name: req.param('name'), email: req.param('email'), password: req.param('password'), role: req.param('role')};
    UserModel.updateUser(userData, function (error, data)
    {
        //Message if user ok
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

/* Get User by id */
router.get('/:customer/user/:id', function (req, res)
{
     var customer=req.params.customer;
    var id = req.params.id;
    //solo actualizamos si la id es un número
    if (!isNaN(id))
    {
        UserModel.getUser(customer,id, function (error, data)
        {
            //If exists show de form
            if (typeof data !== 'undefined' && data.length > 0)
            {
                //res.render("update_user",{ 
                //    title : "", 
                //    info : data
                //});
                res.json(200, {"data": data});

            }
            //Error
            else
            {
                res.json(404, {"msg": "notExist"});
            }
        });
    }
    //Id must be numeric 
    else
    {
        res.json(500, {"msg": "The id must be numeric"});
    }
});




/* remove the user */
router.delete("/user/", function (req, res)
{
    //User id
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