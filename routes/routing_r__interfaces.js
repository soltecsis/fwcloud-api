var express = require('express');
var router = express.Router();
var Routing_r__interfaceModel = require('../models/routing_r__interface');
var api_resp = require('../utils/api_response');
var objModel='ROUTING INTERFACE';


var logger = require('log4js').getLogger("app");

/* get data para crear nuevos */
router.get('/routing-r__interface', function (req, res)
{
    res.render('new_routing_r__interface', {title: 'Crear nuevo routing_r__interface'});
});

/* Get all IPOBJ de una interface*/
router.get('/:interface', function (req, res)
{
    var interface = req.params.interface;
    Routing_r__interfaceModel.getRouting_r__interfaces_rule(interface,function (error, data)
    {
        //If exists routing_r__interface get data
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

/* Get all interface de IPOBJ */
router.get('/:rule', function (req, res)
{
    var rule = req.params.rule;
    Routing_r__interfaceModel.getRouting_r__interfaces_interface(rule,function (error, data)
    {
        //If exists routing_r__interface get data
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



/* Get  routing_r__interface by rule and interface */
router.get('/:interface/:rule', function (req, res)
{    
    var interface = req.params.interface;
    var rule = req.params.rule;
    
    Routing_r__interfaceModel.getRouting_r__interface(interface, rule,function (error, data)
    {
        //If exists routing_r__interface get data
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





/* Create New routing_r__interface */
router.post("/routing-r__interface", function (req, res)
{
    //Create New objet with data routing_r__interface
    var routing_r__interfaceData = {
        rule: req.body.rule,
        interface: req.body.interface,
        interface_order: req.body.interface_order        
    };
    
    Routing_r__interfaceModel.insertRouting_r__interface(routing_r__interfaceData, function (error, data)
    {
        //If saved routing_r__interface Get data
        if (data && data.result)
        {
            //res.redirect("/routing-r__interfaces/routing-r__interface/" + data.insertId);
            api_resp.getJson(null, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        } else
        {
            res.status(500).json( {"error": error});
        }
    });
});

/* Update routing_r__interface that exist */
router.put('/routing-r__interface', function (req, res)
{
    var old_order = req.body.get_column_order;
    //Save data into object
    var routing_r__interfaceData = {
        rule: req.body.rule, 
        interface: req.body.interface, 
        interface_order: req.body.interface_order        
    };
    Routing_r__interfaceModel.updateRouting_r__interface(old_order,routing_r__interfaceData, function (error, data)
    {
        //If saved routing_r__interface saved ok, get data
        if (data && data.result)
        {
            //res.redirect("/routing-r__interfaces/routing-r__interface/" + req.param('id'));
            api_resp.getJson(null, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        } else
        {
            res.status(500).json( {"error": error});
        }
    });
});



/* Update ORDER de routing_r__interface that exist */
router.put('/routing-r__interface/:rule/:position/order/:old_order/:new_order', function (req, res)
{
    var rule = req.param('rule');
    var interface = req.param('interface');
    var old_order = req.param('old_order');
    var new_order = req.param('new_order');    

    Routing_r__interfaceModel.updateRouting_r__interface_order(rule, interface,old_order,new_order, function (error, data)
    {
        //If saved routing_r__interface saved ok, get data
        if (data && data.result)
        {
            //res.redirect("/routing-r__interfaces/routing-r__interface/" + req.param('id'));
            api_resp.getJson(null, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        } else
        {
            res.status(500).json( {"error": error});
        }
    });
});



/* Remove routing_r__interface */
router.delete("/routing-r__interface/", function (req, res)
{
    //Id from routing_r__interface to remove
    var rule = req.param('rule');
    var interface = req.param('interface');
    var old_order = req.param('old_order');
    
    Routing_r__interfaceModel.deleteRouting_r__interfaceidfirewall(rule, interface,old_order, function (error, data)
    {
        if (data && data.result)
        {
            //res.redirect("/routing-r__interfaces/");
            api_resp.getJson(null, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        } else
        {
            res.status(500).json( {"error": error});
        }
    });
});

module.exports = router;