var express = require('express');
var router = express.Router();
var Routing_gModel = require('../models/routing_g');


/* Show form */
router.get('/routing-g', function (req, res)
{
    res.render('new_routing_g', {title: 'Crear nuevo routing_g'});
});

/* Get all routing_gs by firewall*/
router.get('/:idfirewall', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    Routing_gModel.getRouting_gs(idfirewall,function (error, data)
    {
        //If exists routing_g get data
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

/* Get all routing_gs by firewall*/
router.get('/:idfirewall/group/:idgroup', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var idgroup = req.params.idgroup;
    Routing_gModel.getRouting_gs_group(idfirewall, idgroup,function (error, data)
    {
        //If exists routing_g get data
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

/* Get  routing_g by id and  by firewall*/
router.get('/:idfirewall/:id', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var id = req.params.id;
    Routing_gModel.getRouting_g(idfirewall,id,function (error, data)
    {
        //If exists routing_g get data
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

/* Get all routing_gs by nombre and by firewall*/
router.get('/:idfirewall/name/:name', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var name = req.params.name;
    Routing_gModel.getRouting_gName(idfirewall,name,function (error, data)
    {
        //If exists routing_g get data
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





/* Create New routing_g */
router.post("/routing-g", function (req, res)
{
    //Create New objet with data routing_g
    var routing_gData = {
        id: null,
        firewall: req.body.firewall,
        name: req.body.name,
        comment: req.body.comment
    };
    
    Routing_gModel.insertRouting_g(routing_gData, function (error, data)
    {
        //If saved routing_g Get data
        if (data && data.insertId)
        {
            //res.redirect("/routing-gs/routing-g/" + data.insertId);
            res.json(200, {"insertId": data.insertId});
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Update routing_g that exist */
router.put('/routing-g/', function (req, res)
{
    //Save data into object
    var routing_gData = {id: req.param('id'), name: req.param('name'), firewall: req.param('firewall'), comment: req.param('comment')};
    Routing_gModel.updateRouting_g(routing_gData, function (error, data)
    {
        //If saved routing_g saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/routing-gs/routing-g/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});



/* Remove routing_g */
router.delete("/routing-g/", function (req, res)
{
    //Id from routing_g to remove
    var idfirewall = req.param('idfirewall');
    var id = req.param('id');
    Routing_gModel.deleteRouting_gidfirewall(idfirewall,id, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/routing-gs/");
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

module.exports = router;