var express = require('express');
var router = express.Router();
var Policy_r__ipobjModel = require('../models/policy_r__ipobj');
var Policy_r__interfaceModel = require('../models/policy_r__interface');

/**
 * Property Logger to manage App logs
 *
 * @property logger
 * @type log4js/app
 * 
 */
var logger = require('log4js').getLogger("app");


router.param('rule', function (req, res, next, param) {
    if (param === undefined || param === '' || isNaN(param))
        res.status(404).json({"msg": "param rule Error : " + param});
    else
        next();
});
router.param('ipobj', function (req, res, next, param) {
    if (param === undefined || param === '' || isNaN(param)) {
        logger.error("DETECTED UNDEFINED: ipobj");
        req.params.ipobj = 0;
    }
    next();
});
router.param('ipobj_g', function (req, res, next, param) {
    if (param === undefined || param === '' || isNaN(param)) {
        logger.error("DETECTED UNDEFINED: ipobj_g");
        req.params.ipobj_g = 0;
    }
    next();
});
router.param('interface', function (req, res, next, param) {
    if (param === undefined || param === '' || isNaN(param)) {
        logger.error("DETECTED UNDEFINED: interface");
        req.params.interface = 0;
    }
    next();
});
router.param('position', function (req, res, next, param) {
    if (param === undefined || param === '' || isNaN(param)) {
        res.param.status(404).json({"msg": "param position Error"});
    } else
        next();
});
router.param('position_order', function (req, res, next, param) {
    if (param === undefined || param === '' || isNaN(param)) {
        req.params.position = 1;
    }
    next();
});
router.param('new_rule', function (req, res, next, param) {
    if (param === undefined || param === '' || isNaN(param))
        res.status(404).json({"msg": "param new_rule Error"});
    else
        next();
});
router.param('new_position', function (req, res, next, param) {
    if (param === undefined || param === '' || isNaN(param)) {
        res.status(404).json({"msg": "param new_position Error"});
    } else
        next();
});
router.param('new_order', function (req, res, next, param) {
    if (param === undefined || param === '' || isNaN(param)) {
        req.params.new_order = 1;
    }
    next();
});
router.param('negate', function (req, res, next, param) {
    if (param === undefined || param === '' || isNaN(param)) {
        logger.error("DETECTED UNDEFINED: negate");
        req.params.negate = 0;
    }
    next();
});


function checkPostParameters(obj) {
    logger.debug(obj);

    for (var propt in obj) {
        logger.debug(propt + ': ' + obj[propt]);
        if (obj[propt] === undefined) {
            logger.debug("PARAMETRO UNDEFINED: " + propt);
            obj[propt] = 0;
        }
    }
    return obj;
}


/* Show form */
router.get('/policy-r__ipobj', function (req, res)
{
    res.render('new_policy_r__ipobj', {title: 'Crear nuevo policy_r__ipobj'});
});

/* Get all policy_r__ipobjs by rule*/

router.get('/:firewall/:rule', function (req, res)
{
    var rule = req.params.rule;

    Policy_r__ipobjModel.getPolicy_r__ipobjs(rule, function (error, data)
    {
        //If exists policy_r__ipobj get data
        if (typeof data !== 'undefined' && data.length > 0)
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

/* Get all policy_r__ipobjs by rule and posicion*/

router.get('/:firewall/:rule/:position', function (req, res)
{
    var rule = req.params.rule;
    var position = req.params.position;

    Policy_r__ipobjModel.getPolicy_r__ipobjs_position(rule, position, function (error, data)
    {
        //If exists policy_r__ipobj get data
        if (typeof data !== 'undefined' && data.length > 0)
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

/* Get all policy_r__ipobjs by rule and posicion with IPOBJ DATA*/

router.get('/data/:firewall/:rule/:position', function (req, res)
{
    var rule = req.params.rule;
    var position = req.params.position;

    Policy_r__ipobjModel.getPolicy_r__ipobjs_position_data(rule, position, function (error, data)
    {
        //If exists policy_r__ipobj get data
        if (typeof data !== 'undefined' && data.length > 0)
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


/* Get  policy_r__ipobj by id  */

router.get('/:firewall/:rule/:ipobj/:ipobj_g/:interface/:position', function (req, res)
{
    var rule = req.params.rule;
    var ipobj = req.params.ipobj;
    var ipobj_g = req.params.ipobj_g;
    var interface = req.params.interface;
    var position = req.params.position;

    Policy_r__ipobjModel.getPolicy_r__ipobj(rule, ipobj, ipobj_g, interface, position, function (error, data)
    {
        //If exists policy_r__ipobj get data
        if (typeof data !== 'undefined' && data.length > 0)
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


/* Create New policy_r__ipobj */
router.post("/policy-r__ipobj", function (req, res)
{
    //Create New objet with data policy_r__ipobj
    var policy_r__ipobjData = {
        rule: req.body.rule,
        ipobj: req.body.ipobj,
        ipobj_g: req.body.ipobj_g,
        interface: req.body.interface,
        position: req.body.position,
        position_order: req.body.position_order

    };


    policy_r__ipobjData = checkPostParameters(policy_r__ipobjData);


    Policy_r__ipobjModel.insertPolicy_r__ipobj(policy_r__ipobjData, 0, function (error, data)
    {
        //If saved policy_r__ipobj Get data
        if (data && data.msg)
        {
            //res.redirect("/policy-r__ipobjs/policy-r__ipobj/" + data.insertId);
            res.status(200).json(data.msg);
        } else
        {
            res.status(500).json({"error": error});
        }
    });
});

/* Update policy_r__ipobj that exist */
router.put('/policy-r__ipobj', function (req, res)
{
    var rule = req.body.get_rule;
    var ipobj = req.body.get_ipobj;
    var ipobj_g = req.body.get_ipobj_g;
    var interface = req.body.get_interface;
    var position = req.body.get_position;
    var position_order = req.body.get_position_order;


    //Save new data into object
    var policy_r__ipobjData = {
        rule: req.body.rule,
        ipobj: req.body.ipobj,
        ipobj_g: req.body.ipobj_g,
        interface: req.body.interface,
        position: req.body.position,
        position_order: req.body.position_order

    };

    policy_r__ipobjData = checkPostParameters(policy_r__ipobjData);


    Policy_r__ipobjModel.updatePolicy_r__ipobj(rule, ipobj, ipobj_g, interface, position, position_order, policy_r__ipobjData, function (error, data)
    {
        //If saved policy_r__ipobj saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/policy-r__ipobjs/policy-r__ipobj/" + req.param('id'));
            res.status(200).json(data.msg);
        } else
        {
            res.status(500).json({"error": error});
        }
    });
});

/* Update POSITION policy_r__ipobj that exist */
router.put('/policy-r__ipobj/:firewall/:rule/:ipobj/:ipobj_g/:interface/:position/:position_order/:new_rule/:new_position/:new_order', function (req, res)
{
    var rule = req.params.rule;
    var ipobj = req.params.ipobj;
    var ipobj_g = req.params.ipobj_g;
    var interface = req.params.interface;
    var position = req.params.position;
    var position_order = req.params.position_order;
    var new_rule = req.params.new_rule;
    var new_position = req.params.new_position;
    var new_order = req.params.new_order;

    var content1 = 'O', content2 = 'O';

    logger.debug("POLICY_R-IPOBJS  MOVING FROM POSITION " + position + "  TO POSITION: " + new_position);
    
    //Get position type
    Policy_r__ipobjModel.getTypePositions(position, new_position, function (error, data)
    {
        logger.debug(data);
        if (data) {
            content1 = data.content1;
            content2 = data.content2;

            if (content1 === content2) { //SAME POSITION
                Policy_r__ipobjModel.updatePolicy_r__ipobj_position(rule, ipobj, ipobj_g, interface, position, position_order, new_rule, new_position, new_order, function (error, data)
                {
                    //If saved policy_r__ipobj saved ok, get data
                    if (data && data.msg)
                    {
                        res.status(200).json(data.msg);
                    } else
                    {
                        res.status(500).json({"msg": error});
                    }
                });
            } else {//DIFFERENTS POSITIONS
                if (content1 === 'I' && content2 === 'O') {
                    //Create New Position 'O'
                    //Create New objet with data policy_r__ipobj
                    var policy_r__ipobjData = {
                        rule: new_rule,
                        ipobj: ipobj,
                        ipobj_g: ipobj_g,
                        interface: interface,
                        position: new_position,
                        position_order: new_order
                    };

                    policy_r__ipobjData = checkPostParameters(policy_r__ipobjData);

                    Policy_r__ipobjModel.insertPolicy_r__ipobj(policy_r__ipobjData, 0, function (error, data)
                    {
                        //If saved policy_r__ipobj Get data
                        if (data && data.msg)
                        {
                            //Delete position 'I'
                            Policy_r__interfaceModel.deletePolicy_r__interface(rule, interface, position, position_order, function (error, data)
                            {
                                if (data && data.msg === "deleted" || data.msg === "notExist")
                                {
                                    res.status(200).json({"msg": "success"});
                                } else
                                {
                                    res.status(500).json({"error": error});
                                }
                            });
                        } else
                        {
                            res.status(500).json({"error": error});
                        }
                    });



                }
            }
        }
    });




});

/* Update NEGATE policy_r__ipobj that exist */
/* Update ALL IPOBJ/POLICY_R TO new NEGATE satus*/
router.put('/policy-r__ipobj/:firewall/:rule/:position/:negate', function (req, res)
{
    var rule = req.params.rule;
    var position = req.params.position;
    var negate = req.params.negate;


    Policy_r__ipobjModel.updatePolicy_r__ipobj_negate(rule, position, negate, function (error, data)
    {
        //If saved policy_r__ipobj saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/policy-r__ipobjs/policy-r__ipobj/" + req.param('id'));
            res.status(200).json(data.msg);
        } else
        {
            res.status(500).json({"msg": error});
        }
    });
});

/* Update ORDER policy_r__ipobj that exist */
router.put('/policy-r__ipobj/:firewall/:rule/:ipobj/:ipobj_g/:interface/:position/:position_order/:new_order', function (req, res)
{
    var rule = req.params.rule;
    var ipobj = req.params.ipobj;
    var ipobj_g = req.params.ipobj_g;
    var interface = req.params.interface;
    var position = req.params.position;
    var position_order = req.params.position_order;
    var new_order = req.params.new_order;



    Policy_r__ipobjModel.updatePolicy_r__ipobj_position_order(rule, ipobj, ipobj_g, interface, position, position_order, new_order, function (error, data)
    {
        //If saved policy_r__ipobj saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/policy-r__ipobjs/policy-r__ipobj/" + req.param('id'));
            res.status(200).json(data.msg);
        } else
        {
            res.status(500).json({"msg": error});
        }
    });
});




/* Remove policy_r__ipobj */
router.delete("/policy-r__ipobj/:firewall/:rule/:ipobj/:ipobj_g/:interface/:position/:position_order", function (req, res)
{
    //Id from policy_r__ipobj to remove
    var rule = req.params.rule;
    var ipobj = req.params.ipobj;
    var ipobj_g = req.params.ipobj_g;
    var interface = req.params.interface;
    var position = req.params.position;
    var position_order = req.params.position_order;

    Policy_r__ipobjModel.deletePolicy_r__ipobj(rule, ipobj, ipobj_g, interface, position, position_order, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/policy-r__ipobjs/");
            res.status(200).json(data.msg);
        } else
        {
            res.status(500).json({"msg": error});
        }
    });
});

/* Reorder ALL rule positions  */
router.put("/policy-r__ipobj/order", function (req, res)
{    
    Policy_r__ipobjModel.orderAllPolicy(function (error, data)
    {
        if (data && data.msg === "success" || data.msg === "notExist")
        {
            res.status(200).json(data.msg);
        } else
        {
            res.status(500).json({"msg": error});
        }
    });
});

/* Reorder ALL rule positions  */
router.put("/policy-r__ipobj/order/:rule", function (req, res)
{
    var rule = req.params.rule;
    Policy_r__ipobjModel.orderPolicy(rule, function (error, data)
    {
        if (data && data.msg === "success" || data.msg === "notExist")
        {
            res.status(200).json(data.msg);
        } else
        {
            res.status(500).json({"msg": error});
        }
    });
});
/* Reorder rule Positions */
//router.get("/policy-r__ipobj/order/:rule/:position", function (req, res)
//{
//    //Id from policy_r__ipobj to remove
//    var rule = req.params.rule;
//    var position = req.params.position;
//    
//    logger.debug("ORDENANDO REGLA: " + rule + '  Position: ' + position);
//    Policy_r__ipobjModel.orderPolicyPosition(rule,  position,  function (error, data)
//    {
//        if (data && data.msg === "success" || data.msg === "notExist")
//        {
//            res.status(200).json(data.msg);
//        } else
//        {
//            res.status(500).json({"msg": error});
//        }
//    });
//});

module.exports = router;