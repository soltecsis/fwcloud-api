var express = require('express');
var router = express.Router();
var Routing_rModel = require('../../models/routing/routing_r');
var api_resp = require('../../utils/api_response');
var objModel='ROUTING';


var logger = require('log4js').getLogger("app");
var utilsModel = require("../../utils/utils.js");


/* Get all routing_rs by firewall and group*/
router.get('/:idfirewall/group/:idgroup',utilsModel.checkFirewallAccess,  function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var idgroup = req.params.idgroup;
    Routing_rModel.getRouting_rs(idfirewall,idgroup,function (error, data)
    {
        //If exists routing_r get data
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
/* Get all routing_rs by firewall */
router.get('/:idfirewall', utilsModel.checkFirewallAccess, function (req, res)
{
    var idfirewall = req.params.idfirewall;    
    Routing_rModel.getRouting_rs(idfirewall,'',function (error, data)
    {
        //If exists routing_r get data
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

/* Get  routing_r by id and  by firewall and group */
router.get('/:idfirewall/:id', utilsModel.checkFirewallAccess, function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var id = req.params.id;
    Routing_rModel.getRouting_r(idfirewall,id,function (error, data)
    {
        //If exists routing_r get data
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

/* Get all routing_rs by nombre and by firewall*/
router.get('/:idfirewall/:idgroup/name/:name',utilsModel.checkFirewallAccess,  function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var name = req.params.name;
    var idgroup = req.params.idgroup;
    Routing_rModel.getRouting_rName(idfirewall,idgroup,name,function (error, data)
    {
        //If exists routing_r get data
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





/* Create New routing_r */
router.post("/routing-r/:idfirewall", utilsModel.checkFirewallAccess, function (req, res)
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
            var dataresp = {"insertId": data.insertId};
            api_resp.getJson(dataresp, api_resp.ACR_INSERTED_OK, 'INSERTED OK', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        } else
        {
            api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, function (jsonResp) {
                            res.status(200).json(jsonResp);
                        });
        }
    });
});

/* Update routing_r that exist */
router.put('/routing-r/:idfirewall',utilsModel.checkFirewallAccess,  function (req, res)
{
    //Save data into object
    var routing_rData = {id: req.param('id'), idgroup: req.param('idgroup'), firewall: req.param('firewall'), rule_order: req.param('rule_order'),  options: req.param('options'), metric: req.param('metric'), comment: req.param('comment')};
    Routing_rModel.updateRouting_r(routing_rData, function (error, data)
    {
        //If saved routing_r saved ok, get data
        if (data && data.result)
        {
            //res.redirect("/routing-rs/routing-r/" + req.param('id'));
            api_resp.getJson(null, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        } else
        {
            api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, function (jsonResp) {
                            res.status(200).json(jsonResp);
                        });
        }
    });
});



/* Remove routing_r */
router.put("/del/routing-r/:idfirewall", utilsModel.checkFirewallAccess, function (req, res)
{
    //Id from routing_r to remove
    var idfirewall = req.param('idfirewall');
    var id = req.param('id');
    Routing_rModel.deleteRouting_r(idfirewall,id, function (error, data)
    {
        if (data && data.result)
        {
            //res.redirect("/routing-rs/");
            api_resp.getJson(null, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        } else
        {
            api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, function (jsonResp) {
                            res.status(200).json(jsonResp);
                        });
        }
    });
});

module.exports = router;