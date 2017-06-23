var express = require('express');
var router = express.Router();
var Routing_rModel = require('../models/routing_r');


/* Show form */
router.get('/routing-r', function (req, res)
{
    res.render('new_routing_r', {title: 'Crear nuevo routing_r'});
});

/* Get all routing_rs by firewall and group*/
router.get('/:idfirewall/group/:idgroup', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var idgroup = req.params.idgroup;
    Routing_rModel.getRouting_rs(idfirewall,idgroup,function (error, data)
    {
        //If exists routing_r get data
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
/* Get all routing_rs by firewall */
router.get('/:idfirewall', function (req, res)
{
    var idfirewall = req.params.idfirewall;    
    Routing_rModel.getRouting_rs(idfirewall,'',function (error, data)
    {
        //If exists routing_r get data
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

/* Get  routing_r by id and  by firewall and group */
router.get('/:idfirewall/:id', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var id = req.params.id;
    Routing_rModel.getRouting_r(idfirewall,id,function (error, data)
    {
        //If exists routing_r get data
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

/* Get all routing_rs by nombre and by firewall*/
router.get('/:idfirewall/:idgroup/name/:name', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var name = req.params.name;
    var idgroup = req.params.idgroup;
    Routing_rModel.getRouting_rName(idfirewall,idgroup,name,function (error, data)
    {
        //If exists routing_r get data
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





/* Create New routing_r */
router.post("/routing-r", function (req, res)
{
    //Create New objet with data routing_r
    var routing_rData = {
        id: null,
        idgroup: req.body.idgroup,
        firewall: req.body.firewall,
        rule_order: req.body.rule_order,        
        metric: req.body.metric,
        options: req.body.options,
        comment: req.body.comment
    };
    
    Routing_rModel.insertRouting_r(routing_rData, function (error, data)
    {
        //If saved routing_r Get data
        if (data && data.insertId)
        {
            //res.redirect("/routing-rs/routing-r/" + data.insertId);
            res.json(200, {"insertId": data.insertId});
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Update routing_r that exist */
router.put('/routing-r/', function (req, res)
{
    //Save data into object
    var routing_rData = {id: req.param('id'), idgroup: req.param('idgroup'), firewall: req.param('firewall'), rule_order: req.param('rule_order'),  options: req.param('options'), metric: req.param('metric'), comment: req.param('comment')};
    Routing_rModel.updateRouting_r(routing_rData, function (error, data)
    {
        //If saved routing_r saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/routing-rs/routing-r/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});



/* Remove routing_r */
router.delete("/routing-r/", function (req, res)
{
    //Id from routing_r to remove
    var idfirewall = req.param('idfirewall');
    var id = req.param('id');
    Routing_rModel.deleteRouting_r(idfirewall,id, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/routing-rs/");
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

module.exports = router;