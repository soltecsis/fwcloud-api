var express = require('express');
var router = express.Router();
var Ipobj_protocolsModel = require('../../models/ipobj/ipobj_protocols');
var api_resp = require('../../utils/api_response');
var objModel = 'IPOBJ PROTOCOL';


var logger = require('log4js').getLogger("app");


/* Get all ipobj_protocols*/
router.get('/:iduser/:fwcloud/', function (req, res)
{
    Ipobj_protocolsModel.getIpobj_protocols(function (error, data)
    {
        //If exists ipobj_protocols get data
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



/* Get  ipobj_protocols by id */
router.get('/:iduser/:fwcloud/:id', function (req, res)
{
    var id = req.params.id;
    Ipobj_protocolsModel.getIpobj_protocols(id, function (error, data)
    {
        //If exists ipobj_protocols get data
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

/* Get all ipobj_protocols by name */
router.get('/:iduser/:fwcloud/name/:name', function (req, res)
{
    var name = req.params.name;
    Ipobj_protocolsModel.getIpobj_protocolsName(name, function (error, data)
    {
        //If exists ipobj_protocols get data
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




/* Create New ipobj_protocols */
router.post("/ipobj-protocols/:iduser/:fwcloud/", function (req, res)
{
    //Create New objet with data ipobj_protocols
    var ipobj_protocolsData = {
        id: req.body.id,
        keyword: req.body.keyword,
        description: req.body.description
    };

    Ipobj_protocolsModel.insertIpobj_protocols(ipobj_protocolsData, function (error, data)
    {
        if (error)
            api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        else {
            //If saved ipobj_protocols Get data
            if (data && data.insertId)
            {
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
        }
    });
});

/* Update ipobj_protocols that exist */
router.put('/ipobj-protocols/:iduser/:fwcloud/', function (req, res)
{
    //Save data into object
    var ipobj_protocolsData = {
        id: req.param('id'),
        keyword: req.param('keyword'),
        description: req.param('description')
    };
    Ipobj_protocolsModel.updateIpobj_protocols(ipobj_protocolsData, function (error, data)
    {
        if (error)
            api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        else {
            //If saved ipobj_protocols saved ok, get data
            if (data && data.result)
            {
                //res.redirect("/ipobj-protocolss/ipobj-protocols/" + req.param('id'));
                api_resp.getJson(null, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, function (jsonResp) {
                    res.status(200).json(jsonResp);
                });
            } else
            {
                api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, error, function (jsonResp) {
                    res.status(200).json(jsonResp);
                });
            }
        }
    });
});



/* Remove ipobj_protocols */
router.put("/del/ipobj-protocols/:iduser/:fwcloud/", function (req, res)
{
    //Id from ipobj_protocols to remove
    var id = req.param('id');
    Ipobj_protocolsModel.deleteIpobj_protocols(id, function (error, data)
    {
        if (data && data.result)
        {
            api_resp.getJson(null, api_resp.ACR_DELETED_OK, 'DELETE OK', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        } else
        {
            api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, error, function (jsonResp) {
                    res.status(200).json(jsonResp);
                });
        }
    });
});

module.exports = router;