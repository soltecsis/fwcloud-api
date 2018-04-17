var express = require('express');
var router = express.Router();
var Policy_r__ipobjModel = require('../../models/policy/policy_r__ipobj');
var Policy_r__interfaceModel = require('../../models/policy/policy_r__interface');
var api_resp = require('../../utils/api_response');
var Policy_rModel = require('../../models/policy/policy_r');

var logger = require('log4js').getLogger("app");
var utilsModel = require("../../utils/utils.js");

var objModel = "Ipobj in Rule";


router.param('rule', function (req, res, next, param) {
    if (param === undefined || param === '' || isNaN(param))
        api_resp.getJson(null, api_resp.ACR_PARAM_ERROR, ' not found', param, null, function (jsonResp) {
            res.status(200).json(jsonResp);
        });
    else
        next();
});
router.param('ipobj', function (req, res, next, param) {
    if (param === undefined || param === '' || isNaN(param)) {
        logger.error("DETECTED UNDEFINED: ipobj");
        req.params.ipobj = -1;
    }
    next();
});
router.param('ipobj_g', function (req, res, next, param) {
    if (param === undefined || param === '' || isNaN(param)) {
        logger.error("DETECTED UNDEFINED: ipobj_g");
        req.params.ipobj_g = -1;
    }
    next();
});
router.param('interface', function (req, res, next, param) {
    if (param === undefined || param === '' || isNaN(param)) {
        logger.error("DETECTED UNDEFINED: interface");
        req.params.interface = -1;
    }
    next();
});
router.param('position', function (req, res, next, param) {
    if (param === undefined || param === '' || isNaN(param)) {
        api_resp.getJson(null, api_resp.ACR_PARAM_ERROR, ' not found', param, null, function (jsonResp) {
            res.status(200).json(jsonResp);
        });
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
        api_resp.getJson(null, api_resp.ACR_PARAM_ERROR, ' not found', param, null, function (jsonResp) {
            res.status(200).json(jsonResp);
        });
    else
        next();
});
router.param('new_position', function (req, res, next, param) {
    if (param === undefined || param === '' || isNaN(param)) {
        api_resp.getJson(null, api_resp.ACR_PARAM_ERROR, ' not found', param, null, function (jsonResp) {
            res.status(200).json(jsonResp);
        });
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
            obj[propt] = -1;
        }
    }
    return obj;
}



/* Get all policy_r__ipobjs by rule*/

router.get('/:idfirewall/:rule',utilsModel.checkFirewallAccess,  function (req, res)
{
    var rule = req.params.rule;

    Policy_r__ipobjModel.getPolicy_r__ipobjs(rule, function (error, data)
    {
        //If exists policy_r__ipobj get data
        if (data && data.length > 0)
        {
            api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
        //Get Error
        else
        {
            api_resp.getJson(data, api_resp.ACR_NOTEXIST, ' not found', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });

});

/* Get all policy_r__ipobjs by rule and posicion*/

router.get('/:idfirewall/:rule/:position', utilsModel.checkFirewallAccess, function (req, res)
{
    var rule = req.params.rule;
    var position = req.params.position;

    Policy_r__ipobjModel.getPolicy_r__ipobjs_position(rule, position, function (error, data)
    {
        //If exists policy_r__ipobj get data
        if (data && data.length > 0)
        {
            api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
        //Get Error
        else
        {
            api_resp.getJson(data, api_resp.ACR_NOTEXIST, ' not found', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });

});

/* Get all policy_r__ipobjs by rule and posicion with IPOBJ DATA*/

router.get('/data/:idfirewall/:rule/:position',utilsModel.checkFirewallAccess,  function (req, res)
{
    var rule = req.params.rule;
    var position = req.params.position;

    Policy_r__ipobjModel.getPolicy_r__ipobjs_position_data(rule, position, function (error, data)
    {
        //If exists policy_r__ipobj get data
        if (data && data.length > 0)
        {
            api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
        //Get Error
        else
        {
            api_resp.getJson(data, api_resp.ACR_NOTEXIST, ' not found', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });

});


/* Get  policy_r__ipobj by id  */

router.get('/:idfirewall/:rule/:ipobj/:ipobj_g/:interface/:position', utilsModel.checkFirewallAccess, function (req, res)
{
    var rule = req.params.rule;
    var ipobj = req.params.ipobj;
    var ipobj_g = req.params.ipobj_g;
    var interface = req.params.interface;
    var position = req.params.position;

    Policy_r__ipobjModel.getPolicy_r__ipobj(rule, ipobj, ipobj_g, interface, position, function (error, data)
    {
        //If exists policy_r__ipobj get data
        if (data && data.length > 0)
        {

            api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
        //Get Error
        else
        {
            api_resp.getJson(data, api_resp.ACR_NOTEXIST, ' not found', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});


/* Create New policy_r__ipobj */
router.post("/policy-r__ipobj/:idfirewall",utilsModel.checkFirewallAccess,  function (req, res)
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
        if (error)
            api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        else {
            //If saved policy_r__ipobj Get data
            if (data && data.result) {
                if (data.result && data.allowed) {  
                    var accessData = {sessionID: req.sessionID, iduser: req.iduser, fwcloud: req.fwcloud, idfirewall: req.params.idfirewall, rule: policy_r__ipobjData.rule};                
                    Policy_rModel.compilePolicy_r(accessData, function (error, datac) {});
                    api_resp.getJson(data, api_resp.ACR_INSERTED_OK, 'INSERTED OK', objModel, null, function (jsonResp) {
                        res.status(200).json(jsonResp);
                    });
                } else if (!data.allowed) {
                    api_resp.getJson(data, api_resp.ACR_NOT_ALLOWED, 'IPOBJ not allowed in this position', objModel, error, function (jsonResp) {
                        res.status(200).json(jsonResp);
                    });
                } else
                    api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'IPOBJ not found', objModel, error, function (jsonResp) {
                        res.status(200).json(jsonResp);
                    });
            } else
            {
                api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error inserting', objModel, error, function (jsonResp) {
                    res.status(200).json(jsonResp);
                });
            }
        }
    });
});

/* Update policy_r__ipobj that exist */
router.put('/policy-r__ipobj/:idfirewall',utilsModel.checkFirewallAccess,  function (req, res)
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
    
    var accessData = {sessionID: req.sessionID , iduser: req.iduser, fwcloud: req.fwcloud, idfirewall: req.params.idfirewall, rule: rule };



    Policy_r__ipobjModel.updatePolicy_r__ipobj(rule, ipobj, ipobj_g, interface, position, position_order, policy_r__ipobjData, function (error, data)
    {
        if (error)
            api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        else {
            //If saved policy_r__ipobj saved ok, get data
            if (data && data.result) {
                if (data.result) {
                    Policy_rModel.compilePolicy_r(accessData, function (error, datac) {});
                    api_resp.getJson(data, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, function (jsonResp) {
                        res.status(200).json(jsonResp);
                    });
                } else if (!data.allowed) {
                    api_resp.getJson(data, api_resp.ACR_NOT_ALLOWED, 'IPOBJ not allowed in this position', objModel, error, function (jsonResp) {
                        res.status(200).json(jsonResp);
                    });
                } else
                    api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'IPOBJ not found', objModel, error, function (jsonResp) {
                        res.status(200).json(jsonResp);
                    });
            } else
            {
                api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error updating', objModel, error, function (jsonResp) {
                    res.status(200).json(jsonResp);
                });
            }
        }
    });
});

/* Update POSITION policy_r__ipobj that exist */
router.put('/policy-r__ipobj/:idfirewall/:rule/:ipobj/:ipobj_g/:interface/:position/:position_order/:new_rule/:new_position/:new_order',utilsModel.checkFirewallAccess,
 function (req, res)
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
    
    var accessData = {sessionID: req.sessionID , iduser: req.iduser, fwcloud: req.fwcloud, idfirewall: req.params.idfirewall, rule: rule };

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
                    if (data) {
                        if (data.result) {
                            Policy_rModel.compilePolicy_r(accessData, function (error, datac) {});
                            accessData.rule=new_rule;
                            Policy_rModel.compilePolicy_r(accessData, function (error, datac) {});
                            api_resp.getJson(data, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, function (jsonResp) {
                                res.status(200).json(jsonResp);
                            });
                        } else if (!data.allowed) {
                            api_resp.getJson(data, api_resp.ACR_NOT_ALLOWED, 'IPOBJ not allowed in this position', objModel, error, function (jsonResp) {
                                res.status(200).json(jsonResp);
                            });
                        } else
                            api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'IPOBJ not found', objModel, error, function (jsonResp) {
                                res.status(200).json(jsonResp);
                            });
                    } else
                    {
                        api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error updating', objModel, error, function (jsonResp) {
                            res.status(200).json(jsonResp);
                        });
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
                        if (data) {
                            if (data.result) {
                                //Delete position 'I'
                                Policy_r__interfaceModel.deletePolicy_r__interface(rule, interface, position, position_order, function (error, data)
                                {
                                    if (data && data.result)
                                    {
                                        Policy_rModel.compilePolicy_r(accessData, function (error, datac) {});
                                        accessData.rule=new_rule;
                                        Policy_rModel.compilePolicy_r(accessData, function (error, datac) {});
                                        api_resp.getJson(data, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, function (jsonResp) {
                                            res.status(200).json(jsonResp);
                                        });
                                    } else
                                    {
                                        api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error updating', objModel, error, function (jsonResp) {
                                            res.status(200).json(jsonResp);
                                        });
                                    }
                                });
                            } else if (!data.allowed) {
                                api_resp.getJson(data, api_resp.ACR_NOT_ALLOWED, 'IPOBJ not allowed in this position', objModel, error, function (jsonResp) {
                                    res.status(200).json(jsonResp);
                                });
                            } else
                                api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'IPOBJ not found', objModel, error, function (jsonResp) {
                                    res.status(200).json(jsonResp);
                                });

                        } else
                        {
                            api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error updating', objModel, error, function (jsonResp) {
                                res.status(200).json(jsonResp);
                            });
                        }
                    });



                } else {
                    api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error updating, content diffetents', objModel, error, function (jsonResp) {
                        res.status(200).json(jsonResp);
                    });
                }
            }
        } else {
            api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error updating, data error', objModel, error, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });




});

/* Update NEGATE policy_r__ipobj that exist */
/* Update ALL IPOBJ/POLICY_R TO new NEGATE satus*/
router.put('/policy-r__ipobj/:idfirewall/:rule/:position/:negate',utilsModel.checkFirewallAccess,  function (req, res)
{
    var rule = req.params.rule;
    var position = req.params.position;
    var negate = req.params.negate;


    Policy_r__ipobjModel.updatePolicy_r__ipobj_negate(rule, position, negate, function (error, data)
    {
        if (error)
            api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        else {
            //If saved policy_r__ipobj saved ok, get data
            if (data && data.result)
            {
                var accessData = {sessionID: req.sessionID, iduser: req.iduser, fwcloud: req.fwcloud, idfirewall: req.params.idfirewall, rule: rule};                
                Policy_rModel.compilePolicy_r(accessData, function (error, datac) {});
                api_resp.getJson(data, api_resp.ACR_UPDATED_OK, 'SET NEGATED OK', objModel, null, function (jsonResp) {
                    res.status(200).json(jsonResp);
                });
            } else
            {
                api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error updating', objModel, error, function (jsonResp) {
                    res.status(200).json(jsonResp);
                });
            }
        }
    });
});

/* Update ORDER policy_r__ipobj that exist */
router.put('/policy-r__ipobj/:idfirewall/:rule/:ipobj/:ipobj_g/:interface/:position/:position_order/:new_order',utilsModel.checkFirewallAccess,  function (req, res)
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
        if (error)
            api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        else {
            //If saved policy_r__ipobj saved ok, get data
            if (data && data.result)
            {          
                var accessData = {sessionID: req.sessionID, iduser: req.iduser, fwcloud: req.fwcloud, idfirewall: req.params.idfirewall, rule: rule};                
                Policy_rModel.compilePolicy_r(accessData, function (error, datac) {});
                api_resp.getJson(data, api_resp.ACR_UPDATED_OK, 'SET ORDER OK', objModel, null, function (jsonResp) {
                    res.status(200).json(jsonResp);
                });
            } else
            {
                api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error updating', objModel, error, function (jsonResp) {
                    res.status(200).json(jsonResp);
                });
            }
        }
    });
});




/* Remove policy_r__ipobj */
router.put("/del/policy-r__ipobj/:idfirewall/:rule/:ipobj/:ipobj_g/:interface/:position/:position_order",utilsModel.checkFirewallAccess,  function (req, res)
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
        if (data && data.result) {
            if (data.msg === "deleted")
            {
                var accessData = {sessionID: req.sessionID, iduser: req.iduser, fwcloud: req.fwcloud, idfirewall: req.params.idfirewall, rule: rule};                
                Policy_rModel.compilePolicy_r(accessData, function (error, datac) {});
                api_resp.getJson(data, api_resp.ACR_DELETED_OK, 'DELETE OK', objModel, null, function (jsonResp) {
                    res.status(200).json(jsonResp);
                });
            } else if (data.msg === "notExist") {
                api_resp.getJson(data, api_resp.ACR_NOTEXIST, '', objModel, null, function (jsonResp) {
                    res.status(200).json(jsonResp);
                });
            }
        } else
        {
            api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error updating', objModel, error, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});

/* Reorder ALL rule positions  */
router.put("/policy-r__ipobj/order/:idfirewall",utilsModel.checkFirewallAccess, function (req, res)
{
    Policy_r__ipobjModel.orderAllPolicy(function (error, data)
    {
        if (data && data.result)
        {
            api_resp.getJson(data, api_resp.ACR_DELETED_OK, 'REORDER OK', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        } else
        {
            api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error REORDER', objModel, error, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});

/* Reorder ALL rule positions  */
router.put("/policy-r__ipobj/order/:idfirewall/:rule",utilsModel.checkFirewallAccess,  function (req, res)
{
    var rule = req.params.rule;
    Policy_r__ipobjModel.orderPolicy(rule, function (error, data)
    {
        if (data && data.result)
        {
            api_resp.getJson(data, api_resp.ACR_DELETED_OK, 'REORDER OK', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        } else
        {
            api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error REORDER', objModel, error, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
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
//            api_resp.getJson(data, api_resp.ACR_ERROR, 'Error inserting', objModel, error, function (jsonResp) {
//                            res.status(200).json(jsonResp);
//                        });
//        }
//    });
//});

module.exports = router;