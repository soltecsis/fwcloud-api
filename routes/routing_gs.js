var express = require('express');
var router = express.Router();
var Routing_gModel = require('../models/routing_g');
var api_resp = require('../utils/api_response');
var objModel='ROUTING TYPE';

/**
* Property Logger to manage App logs
*
* @property logger
* @type log4js/app
* 
*/
var logger = require('log4js').getLogger("app");

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

/* Get all routing_gs by firewall*/
router.get('/:idfirewall/group/:idgroup', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var idgroup = req.params.idgroup;
    Routing_gModel.getRouting_gs_group(idfirewall, idgroup,function (error, data)
    {
        //If exists routing_g get data
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

/* Get  routing_g by id and  by firewall*/
router.get('/:idfirewall/:id', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var id = req.params.id;
    Routing_gModel.getRouting_g(idfirewall,id,function (error, data)
    {
        //If exists routing_g get data
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

/* Get all routing_gs by nombre and by firewall*/
router.get('/:idfirewall/name/:name', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var name = req.params.name;
    Routing_gModel.getRouting_gName(idfirewall,name,function (error, data)
    {
        //If exists routing_g get data
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

/* Update routing_g that exist */
router.put('/routing-g/', function (req, res)
{
    //Save data into object
    var routing_gData = {id: req.param('id'), name: req.param('name'), firewall: req.param('firewall'), comment: req.param('comment')};
    Routing_gModel.updateRouting_g(routing_gData, function (error, data)
    {
        //If saved routing_g saved ok, get data
        if (data && data.result)
        {
            //res.redirect("/routing-gs/routing-g/" + req.param('id'));
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



/* Remove routing_g */
router.delete("/routing-g/", function (req, res)
{
    //Id from routing_g to remove
    var idfirewall = req.param('idfirewall');
    var id = req.param('id');
    Routing_gModel.deleteRouting_gidfirewall(idfirewall,id, function (error, data)
    {
        if (data && data.result)
        {
            //res.redirect("/routing-gs/");
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