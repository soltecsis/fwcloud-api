var express = require('express');
var router = express.Router();
var Ipobj_typeModel = require('../models/ipobj_type');
var api_resp = require('../utils/api_response');
var objModel='IPOBJ TYPE';

/**
* Property Logger to manage App logs
*
* @property logger
* @type log4js/app
* 
*/
var logger = require('log4js').getLogger("app");

/* get data para crear nuevos */
router.get('/ipobj-type', function (req, res)
{
    res.render('new_ipobj_type', {title: 'Crear nuevo ipobj_type'});
});

/* Get all ipobj_types*/
router.get('/', function (req, res)
{

    Ipobj_typeModel.getIpobj_types(function (error, data)
    {
        //If exists ipobj_type get data
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



/* Get  ipobj_type by id */
router.get('/:id', function (req, res)
{    
    var id = req.params.id;
    Ipobj_typeModel.getIpobj_type(id,function (error, data)
    {
        //If exists ipobj_type get data
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

/* Get all ipobj_types by nombre */
router.get('/name/:name', function (req, res)
{
    var name = req.params.name;
    Ipobj_typeModel.getIpobj_typeName(name,function (error, data)
    {
        //If exists ipobj_type get data
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




/* Create New ipobj_type */
router.post("/ipobj-type", function (req, res)
{
    //Create New objet with data ipobj_type
    var ipobj_typeData = {
        id: req.body.id,
        type: req.body.type
    };
    
    Ipobj_typeModel.insertIpobj_type(ipobj_typeData, function (error, data)
    {
        //If saved ipobj_type Get data
        if (data && data.insertId)
        {
            //res.redirect("/ipobj-types/ipobj-type/" + data.insertId);
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

/* Update ipobj_type that exist */
router.put('/ipobj-type/', function (req, res)
{
    //Save data into object
    var ipobj_typeData = {
        id: req.param('id'), 
        type: req.param('type')
    };
    Ipobj_typeModel.updateIpobj_type(ipobj_typeData, function (error, data)
    {
        //If saved ipobj_type saved ok, get data
        if (data && data.result)
        {
            //res.redirect("/ipobj-types/ipobj-type/" + req.param('id'));
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



/* Remove ipobj_type */
router.delete("/ipobj-type/", function (req, res)
{
    //Id from ipobj_type to remove
    var id = req.param('id');
    Ipobj_typeModel.deleteIpobj_type(id, function (error, data)
    {
        if (data && data.result)
        {
            //res.redirect("/ipobj-types/");
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