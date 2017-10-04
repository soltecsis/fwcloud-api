var express = require('express');
var router = express.Router();
var Policy_rModel = require('../models/policy_r');
var utilsModel = require("../utils/utils.js");


/**
 * Property Logger to manage App logs
 *
 * @property logger
 * @type log4js/app
 * 
 */
var logger = require('log4js').getLogger("app");


/* Get all policy_rs by firewall and group*/
router.get('/:iduser/:fwcloud/:idfirewall/group/:idgroup', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var idgroup = req.params.idgroup;
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;

    Policy_rModel.getPolicy_rs(idfirewall, idgroup, function (error, data)
    {
        //If exists policy_r get data
        if (typeof data !== 'undefined')
        {
            res.status(200).json({"data": data});
        }
        //Get Error
        else
        {
            res.status(404).json({"msg": "notExist"});
        }
    });
});
/* Get all policy_rs by firewall and type */
router.get('/:iduser/:fwcloud/:idfirewall/type/:type', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var type = req.params.type;
    var rule = "";
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;

    logger.debug("MOSTRANDO POLICY para firewall: " + idfirewall);
    Policy_rModel.getPolicy_rs_type(fwcloud,idfirewall, type, rule, function (error, data)
    {
        //If exists policy_r get data
        if (typeof data !== 'undefined')
        {
            res.status(200).json({"data": data});
        }
        //Get Error
        else
        {
            res.status(404).json({"msg": "notExist"});
        }
    });
});
/* Get all policy_rs by firewall and type and Rule */
router.get('/:iduser/:fwcloud/:idfirewall/type/:type/rule/:rule', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var type = req.params.type;
    var rule = req.params.rule;
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;


    logger.debug("MOSTRANDO POLICY para firewall: " + idfirewall + " REGLA: " + rule + "  TYPE:" + type );
    Policy_rModel.getPolicy_rs_type(fwcloud, idfirewall, type, rule, function (error, data)
    {
        //If exists policy_r get data
        if (data !== null)
        {
            res.status(200).json({"data": data});
        }
        //Get Error
        else
        {
            res.status(404).json({"msg": "notExist"});
        }
    });
});

/* Get  policy_r by id and  by Id */
router.get('/:iduser/:fwcloud/:idfirewall/:id', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var id = req.params.id;
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;

    Policy_rModel.getPolicy_r(idfirewall, id, function (error, data)
    {
        //If exists policy_r get data
        if (typeof data !== 'undefined')
        {
//            res.render("update_policy_r",{ 
//                    title : "FWBUILDER", 
//                    info : data
//                });  
            res.status(200).json({"data": data});
        }
        //Get Error
        else
        {
            res.status(404).json({"msg": "notExist"});
        }
    });
});

/* Get all policy_rs by nombre and by firewall*/
router.get('/:iduser/:fwcloud/:idfirewall/group/:idgroup/name/:name', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var name = req.params.name;
    var idgroup = req.params.idgroup;
     var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;
    
    Policy_rModel.getPolicy_rName(idfirewall, idgroup, name, function (error, data)
    {
        //If exists policy_r get data
        if (typeof data !== 'undefined')
        {
            res.status(200).json({"data": data});
        }
        //Get Error
        else
        {
            res.status(404).json({"msg": "notExist"});
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

    utilsModel.checkParameters(policy_rData, function (obj) {
        policy_rData = obj;
    });

    Policy_rModel.insertPolicy_r(policy_rData, function (error, data)
    {
        //If saved policy_r Get data
        if (data && data.insertId)
        {
            //res.redirect("/policy-rs/policy-r/" + data.insertId);
            res.status(200).json({"insertId": data.insertId});
        } else
        {
            res.status(500).json({"msg": error});
        }
    });
});

/* Update policy_r that exist */
router.put('/policy-r/', function (req, res)
{
    //Save data into object
    var policy_rData = {id: req.body.id, idgroup: req.body.idgroup, firewall: req.body.firewall, rule_order: req.body.rule_order, options: req.body.options, action: req.body.action, time_start: req.body.time_start, time_end: req.body.time_end, comment: req.body.comment, active: req.body.active, type: req.body.type};

    utilsModel.checkParameters(policy_rData, function (obj) {
        policy_rData = obj;
    });


    var old_order = req.body.old_order;

    Policy_rModel.updatePolicy_r(old_order, policy_rData, function (error, data)
    {
        //If saved policy_r saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/policy-rs/policy-r/" + req.param('id'));
            res.status(200).json(data.msg);
        } else
        {
            res.status(500).json({"msg": error});
        }
    });
});

/* Update ORDER de policy_r that exist */
router.put('/policy-r/order/:idfirewall/:type/:id/:old_order/:new_order', function (req, res)
{
    //Save data into object
    var idfirewall = req.params.idfirewall;
    var type = req.params.type;
    var id = req.params.id;
    var new_order = req.params.new_order;
    var old_order = req.params.old_order;


    Policy_rModel.updatePolicy_r_order(idfirewall, type, id, new_order, old_order, function (error, data)
    {
        //If saved policy_r saved ok, get data
        if (data && data.msg)
        {
            res.status(200).json(data.msg);
        } else
        {
            res.status(500).json({"msg": error});
        }
    });
});



/* Remove policy_r */
router.delete("/policy-r/:iduser/:idfirewall/:id/:rule_order", function (req, res)
{
    //Id from policy_r to remove
    var iduser = req.params.idfirewall;
    var idfirewall = req.params.idfirewall;
    var id = req.params.id;
    var rule_order = req.params.rule_order;

    Policy_rModel.deletePolicy_r(idfirewall, id, rule_order, function (error, data)
    {
        if (error)
            res.status(500).json({"msg": error});
        else
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {

            res.status(200).json(data.msg);
        } else
        {
            res.status(500).json({"msg": error});
        }

    });
});

module.exports = router;