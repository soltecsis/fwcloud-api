var express = require('express');
var router = express.Router();
var Ipobj_typeModel = require('../models/ipobj_type');

var isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.redirect('/');
};

router.get('/*',isAuthenticated, function (req, res, next){
    return next();
});

/* get data para crear nuevos */
router.get('/ipobj-type', function (req, res)
{
    res.render('new_ipobj_type', {title: 'Crear nuevo ipobj_type'});
});

/* Get all ipobj_types*/
router.get('/', function (req, res)
{

    Ipobj_typeModel.getIpobj_types(function (error, data)
    {
        //If exists ipobj_type get data
        if (typeof data !== 'undefined')
        {
            res.json(200, data);
        }
        //Get Error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});



/* Get  ipobj_type by id */
router.get('/:id', function (req, res)
{    
    var id = req.params.id;
    Ipobj_typeModel.getIpobj_type(id,function (error, data)
    {
        //If exists ipobj_type get data
        if (typeof data !== 'undefined')
        {
            res.json(200, data);
        }
        //Get Error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});

/* Get all ipobj_types by nombre */
router.get('/name/:name', function (req, res)
{
    var name = req.params.name;
    Ipobj_typeModel.getIpobj_typeName(name,function (error, data)
    {
        //If exists ipobj_type get data
        if (typeof data !== 'undefined')
        {
            res.json(200, data);
        }
        //Get Error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});




/* Create New ipobj_type */
router.post("/ipobj-type", function (req, res)
{
    //Create New objet with data ipobj_type
    var ipobj_typeData = {
        id: req.body.id,
        type: req.body.type
    };
    
    Ipobj_typeModel.insertIpobj_type(ipobj_typeData, function (error, data)
    {
        //If saved ipobj_type Get data
        if (data && data.insertId)
        {
            //res.redirect("/ipobj-types/ipobj-type/" + data.insertId);
            res.json(200, {"insertId": data.insertId});
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Update ipobj_type that exist */
router.put('/ipobj-type/', function (req, res)
{
    //Save data into object
    var ipobj_typeData = {
        id: req.param('id'), 
        type: req.param('type')
    };
    Ipobj_typeModel.updateIpobj_type(ipobj_typeData, function (error, data)
    {
        //If saved ipobj_type saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/ipobj-types/ipobj-type/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});



/* Remove ipobj_type */
router.delete("/ipobj-type/", function (req, res)
{
    //Id from ipobj_type to remove
    var id = req.param('id');
    Ipobj_typeModel.deleteIpobj_type(id, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/ipobj-types/");
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

module.exports = router;