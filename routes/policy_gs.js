var express = require('express');
var router = express.Router();
var Policy_gModel = require('../models/policy_g');
var Policy_rModel = require('../models/policy_r');
var api_resp = require('../utils/api_response');
var objModel = 'POLICY GROUP';


var logger = require('log4js').getLogger("app");


/* Get all policy_gs by firewall*/
router.get('/:idfirewall', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    Policy_gModel.getPolicy_gs(idfirewall, function (error, data)
    {
        //If exists policy_g get data
        if (data && data.length > 0)
        {
            api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
        //Get Error
        else
        {
            api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});

/* Get all policy_gs by firewall and group father*/
router.get('/:idfirewall/group/:idgroup', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var idgroup = req.params.idgroup;
    Policy_gModel.getPolicy_gs_group(idfirewall, idgroup, function (error, data)
    {
        //If exists policy_g get data
        if (data && data.length > 0)
        {
            api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
        //Get Error
        else
        {
            api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});

/* Get  policy_g by id and  by firewall*/
router.get('/:idfirewall/:id', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var id = req.params.id;
    Policy_gModel.getPolicy_g(idfirewall, id, function (error, data)
    {
        //If exists policy_g get data
        if (data && data.length > 0)
        {
            api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
        //Get Error
        else
        {
            api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});

/* Get all policy_gs by nombre and by firewall*/
router.get('/:idfirewall/name/:name', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var name = req.params.name;
    Policy_gModel.getPolicy_gName(idfirewall, name, function (error, data)
    {
        //If exists policy_g get data
        if (data && data.length > 0)
        {
            api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
        //Get Error
        else
        {
            api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});





/* Create New policy_g */
router.post("/policy-g", function (req, res)
{

    var JsonCopyData = req.body;
    var policy_gData = JsonCopyData.groupData;

    Policy_gModel.insertPolicy_g(policy_gData, function (error, data)
    {
        if (error)
            api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        else {
            //If saved policy_g Get data
            if (data && data.insertId)
            {
                if (policy_gData.rulesIds.length > 0) {
                    var idGroup = data.insertId;
                    //Add rules to group
                    for (var rule of policy_gData.rulesIds) {
                        Policy_rModel.updatePolicy_r_Group(policy_gData.firewall, idGroup, rule, function (error, data) {
                            logger.debug("ADDED to Group " + idGroup + " POLICY: " + rule);
                        });
                    }
                }
                var dataresp = {"insertId": data.insertId};
                api_resp.getJson(dataresp, api_resp.ACR_INSERTED_OK, 'INSERTED OK', objModel, null, function (jsonResp) {
                    res.status(200).json(jsonResp);
                });
            } else
            {
                api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
                    res.status(200).json(jsonResp);
                });
            }
        }
    });
});

/* Update policy_g that exist */
router.put('/policy-g/', function (req, res)
{
    //Save data into object
    var policy_gData = {id: req.param('id'), name: req.param('name'), firewall: req.param('firewall'), comment: req.param('comment')};
    Policy_gModel.updatePolicy_g(policy_gData, function (error, data)
    {
        if (error)
            api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        else {
            //If saved policy_g saved ok, get data
            if (data && data.result)
            {
                //res.redirect("/policy-gs/policy-g/" + req.param('id'));
                api_resp.getJson(null, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, function (jsonResp) {
                    res.status(200).json(jsonResp);
                });
            } else
            {
                api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
                    res.status(200).json(jsonResp);
                });
            }
        }
    });
});



/* Remove policy_g */
router.delete("/policy-g/:idfirewall/:id", function (req, res)
{
    //Id from policy_g to remove
    var idfirewall = req.params.idfirewall;
    var id = req.params.id;

    //Remove group from Rules
    Policy_rModel.updatePolicy_r_GroupAll(idfirewall, id, function (error, data) {
        logger.debug("Removed all Policy from Group " + id);
        Policy_gModel.deletePolicy_g(idfirewall, id, function (error, data)
        {
            if (error)
                api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function (jsonResp) {
                    res.status(200).json(jsonResp);
                });
            else {
                if (data && data.result)
                {
                    api_resp.getJson(null, api_resp.ACR_DELETED_OK, 'DELETED OK', objModel, null, function (jsonResp) {
                        res.status(200).json(jsonResp);
                    });
                } else
                {
                    api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
                        res.status(200).json(jsonResp);
                    });
                }
            }
        });
    });
});

/* Remove rule from policy_g */
router.delete("/policy-g/:idfirewall/:id/:idrule", function (req, res)
{
    //Id from policy_g to remove
    var idfirewall = req.params.idfirewall;
    var id = req.params.id;
    var idrule = req.params.idrule;

    //Remove group from Rules
    Policy_rModel.updatePolicy_r_Group(idfirewall, null, idrule, function (error, data) {
        logger.debug("Removed Policy " + idrule + " from Group " + id);

        if (error)
            api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        else {
            if (data && data.result)
            {
                api_resp.getJson(null, api_resp.ACR_DELETED_OK, 'DELETED OK', objModel, null, function (jsonResp) {
                    res.status(200).json(jsonResp);
                });
            } else
            {
                api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
                    res.status(200).json(jsonResp);
                });
            }
        }
    });
});

module.exports = router;