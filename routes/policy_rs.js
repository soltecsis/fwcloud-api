var express = require('express');
var router = express.Router();
var Policy_rModel = require('../models/policy_r');

var logger = require('log4js').getLogger("app");


/* Show form */
router.get('/policy-r', function (req, res)
{
    res.render('new_policy_r', {title: 'Crear nuevo policy_r'});
});

/* Get all policy_rs by firewall and group*/
router.get('/:idfirewall/group/:idgroup', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var idgroup = req.params.idgroup;
    Policy_rModel.getPolicy_rs(idfirewall,idgroup,function (error, data)
    {
        //If exists policy_r get data
        if (typeof data !== 'undefined')
        {
            res.json(200, {"data": data});
        }
        //Get Error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});
/* Get all policy_rs by firewall and type */
router.get('/:idfirewall/type/:type', function (req, res)
{
    var idfirewall = req.params.idfirewall;    
    var type = req.params.type;    
    logger.debug("MOSTRANDO POLICY para firewall: " + idfirewall);
    Policy_rModel.getPolicy_rs_type(idfirewall,type,function (error, data)
    {
        //If exists policy_r get data
        if (typeof data !== 'undefined')
        {
            res.json(200, {"data": data});
        }
        //Get Error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});

/* Get  policy_r by id and  by Id */
router.get('/:idfirewall/:id', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var id = req.params.id;
    
    Policy_rModel.getPolicy_r(idfirewall,id,function (error, data)
    {
        //If exists policy_r get data
        if (typeof data !== 'undefined')
        {
//            res.render("update_policy_r",{ 
//                    title : "FWBUILDER", 
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
});

/* Get all policy_rs by nombre and by firewall*/
router.get('/:idfirewall/group/:idgroup/name/:name', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var name = req.params.name;
    var idgroup = req.params.idgroup;
    Policy_rModel.getPolicy_rName(idfirewall,idgroup,name,function (error, data)
    {
        //If exists policy_r get data
        if (typeof data !== 'undefined')
        {
            res.json(200, {"data": data});
        }
        //Get Error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});





/* Create New policy_r */
router.post("/policy-r", function (req, res)
{
    //Create New objet with data policy_r
    var policy_rData = {
        id: null,
        idgroup: req.body.idgroup,
        firewall: req.body.firewall,        
        rule_order: req.body.rule_order,        
        action: req.body.action,
        time_start: req.body.time_start,
        time_end: req.body.time_end,
        active: req.body.active,
        options: req.body.options,
        comment: req.body.comment,
        type: req.body.type        
    };
    
    Policy_rModel.insertPolicy_r(policy_rData, function (error, data)
    {
        //If saved policy_r Get data
        if (data && data.insertId)
        {
            //res.redirect("/policy-rs/policy-r/" + data.insertId);
            res.json(200, {"insertId": data.insertId});
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Update policy_r that exist */
router.put('/policy-r/', function (req, res)
{
    //Save data into object
    var policy_rData = {id: req.param('id'), idgroup: req.param('idgroup'), firewall: req.param('firewall'),  rule_order: req.param('rule_order'),   options: req.param('options'), action: req.param('action'), time_start: req.param('time_start'), time_end: req.param('time_end'), comment: req.param('comment'), active: req.param('active'), type: req.param('type')};
    var old_order=req.param('old_order');
    Policy_rModel.updatePolicy_r(old_order,policy_rData, function (error, data)
    {
        //If saved policy_r saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/policy-rs/policy-r/" + req.param('id'));
            res.json(200, {"data": data}.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Update ORDER de policy_r that exist */
router.put('/policy-r/', function (req, res)
{
    //Save data into object
    var idfirewall = req.param('idfirewall');
    var id = req.param('id');
    var rule_order = req.param('rule_order');    
    var old_order=req.param('old_order');
    
    Policy_rModel.updatePolicy_r_order(idfirewall,id, rule_order, old_order, function (error, data)
    {
        //If saved policy_r saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/policy-rs/policy-r/" + req.param('id'));
            res.json(200, {"data": data}.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});



/* Remove policy_r */
router.delete("/policy-r/", function (req, res)
{
    //Id from policy_r to remove
    var idfirewall = req.param('idfirewall');
    var id = req.param('id');
    var rule_order = req.param('rule_order');
    Policy_rModel.deletePolicy_r(idfirewall,id, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/policy-rs/");
            res.json(200, {"data": data}.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

module.exports = router;