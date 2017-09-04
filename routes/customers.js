var express = require('express');
var router = express.Router();
var CustomerModel = require('../models/customers');

/**
* Property Logger to manage App logs
*
* @property logger
* @type log4js/app
* 
*/
var logger = require('log4js').getLogger("app");

/* Get all customers */
router.get('/', function (req, res)
{
    CustomerModel.getCustomers(function (error, data)
    {
        //Get data
        if (typeof data !== 'undefined')
        {
//            res.render("show_customers",{ 
//                title : "Mostrando listado de Customers", 
//                customers : data
//            });
            res.status(200).json( data);
        }
        //Get error
        else
        {
            res.status(404).json( {"msg": "notExist"});
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
            //res.redirect("/customers/customer/" + data.insertId);
            res.status(200).json( {"insertId": data.insertId});
        } else
        {
            res.status(500).json( {"msg": "Error"});
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
        if (data && data.msg)
        {
            //res.redirect("/customers/customer/" + req.param('id'));
            res.status(200).json( data.msg);
        } else
        {
            res.status(500).json( {"msg": "Error"});
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
            if (typeof data !== 'undefined' && data.length > 0)
            {
//                res.render("update_customer",{ 
//                    title : "Servicio rest con nodejs, express 4 and mysql", 
//                    info : data
//                });
                res.status(200).json( data);

            }
            //Get error
            else
            {
                res.status(404).json( {"msg": "notExist"});
            }
        });
    }
    //id must be numeric
    else
    {
        res.status(500).json( {"msg": "The id must be numeric"});
    }
});



/* remove customer */
router.delete("/customer/", function (req, res)
{

    var id = req.param('id');
    CustomerModel.deleteCustomer(id, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/customers/");
            res.status(200).json( data.msg);
        } else
        {
            res.status(500).json( {"msg": "Error"});
        }
    });
});

module.exports = router;