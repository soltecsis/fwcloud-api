var express = require('express');
var router = express.Router();
var User__firewallModel = require('../models/user__firewall');



/* Show form */
//router.get('/', function(req, res) 
//{
//  res.render('index', { title: 'Mostrando listado de User__firewalls'});
//});

/* Get all user__firewalls from user */
router.get('/:id_user', function (req, res)
{
    var id_user = req.params.id_user;
    User__firewallModel.getUser__firewalls(id_user, function (error, data)
    {
        //If exists user__firewall get data
        if (typeof data !== 'undefined')
        {
//            res.render("show_user__firewalls",{ 
//                title : "Mostrando listado de User__firewalls", 
//                user__firewalls : data
//            });
            res.json(200, {"data": data});
        }
        //Get Error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});

/* Get user__firewall by  id  */
router.get('/user__firewall/:id_user/:id_firewall', function (req, res)
{
    var id_user = req.params.id_user;
    var id_firewall = req.params.id_firewall;
    //
    if (!isNaN(id_user))
    {
        User__firewallModel.getUser__firewall(id_user, id_firewall, function (error, data)
        {
            //If exists user__firewall get data
            if (typeof data !== 'undefined' && data.length > 0)
            {
//                res.render("update_user__firewall",{ 
//                    title : "Servicio rest con nodejs, express 4 and mysql", 
//                    info : data
//                });
                res.json(200, {"data": data});

            }
            //Get Error
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



/* Show form */
router.get('/user__firewall', function (req, res)
{
    res.render('new_user__firewall', {title: 'Servicio rest con nodejs, express 4 and mysql'});
});

/* Create New user__firewall */
router.post("/user__firewall", function (req, res)
{
    //Create New objet with data user__firewall
    var user__firewallData = {
        id_user: req.body.id_user,
        id_firewall: req.body.id_firewall
    };
    User__firewallModel.insertUser__firewall(user__firewallData, function (error, data)
    {
        //If saved user__firewall Get data
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

/* Update user__firewall that exist */
router.put('/user__firewall/', function (req, res)
{
    //Save data into object
    var user__firewallData = {id_user: req.param('id_user'), id_firewall: req.param('id_firewall')};
    User__firewallModel.updateUser__firewall(user__firewallData, function (error, data)
    {
        //If saved user__firewall saved ok, get data
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



/* Remove user__firewall */
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