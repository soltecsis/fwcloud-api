var express = require('express');
var router = express.Router();
var CustomerModel = require('../../models/user/customers');
var api_resp = require('../../utils/api_response');
var objModel = 'CUSTOMER';



/* Get all customers */
router.get('/', function (req, res)
{
    CustomerModel.getCustomers(function (error, data)
    {
        //Get data
        if (data && data.length > 0)
        {
            api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
        //Get error
        else
        {
            api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});

/* Form for new customers */
router.get('/customer', function (req, res)
{
    res.render('new_customer', {title: 'Servicio rest con nodejs, express 4 and mysql'});
});

/* New customer */
router.post("/customer", function (req, res)
{
    //New object with customer data
    var customerData = {
        id: null,
        name: req.body.name,
        email: req.body.email,
        address: req.body.address,
        cif: req.body.cif,
        telephone: req.body.telephone,
        web: req.body.web
    };
    CustomerModel.insertCustomer(customerData, function (error, data)
    {
        //Get info
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
    });
});

/* update customer */
router.put('/customer/', function (req, res)
{
    //Save customer data into object
    var customerData = {id: req.param('id'), name: req.param('name'), email: req.param('email'), cif: req.param('cif'), address: req.param('address'), telephone: req.param('telephone'), web: req.param('web')};
    CustomerModel.updateCustomer(customerData, function (error, data)
    {
        //saved ok
        if (data && data.result)
        {
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

/* Get customer by Id */
router.get('/customer/:id', function (req, res)
{
    var id = req.params.id;

    if (!isNaN(id))
    {
        CustomerModel.getCustomer(id, function (error, data)
        {
            //Get data
            if (data && data.length > 0)
            {
                api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
                    res.status(200).json(jsonResp);
                });

            }
            //Get error
            else
            {
                api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
                    res.status(200).json(jsonResp);
                });
            }
        });
    }
    //id must be numeric
    else
    {
        api_resp.getJson(null, api_resp.ACR_DATA_ERROR, '', objModel, null, function (jsonResp) {
            res.status(200).json(jsonResp);
        });
    }
});



/* remove customer */
router.delete("/customer/", function (req, res)
{

    var id = req.param('id');
    CustomerModel.deleteCustomer(id, function (error, data)
    {
        if (data && data.result)
        {
            api_resp.getJson(null, api_resp.ACR_DELETED_OK, 'DELETED OK', objModel, null, function (jsonResp) {
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