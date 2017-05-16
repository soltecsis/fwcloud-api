var express = require('express');
var router = express.Router();
var CustomerModel = require('../models/customers');

var isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.redirect('/');
};

router.get('/*',isAuthenticated, function (req, res, next){
    return next();
});

/* Mostramos el formulario para crear usuarios nuevos */
//router.get('/', function(req, res) 
//{
//  res.render('index', { title: 'Mostrando listado de Customers'});
//});

/* Obtenemos y mostramos todos los customers */
router.get('/', function (req, res)
{
    CustomerModel.getCustomers(function (error, data)
    {
        //si existe el customer mostramos el formulario
        if (typeof data !== 'undefined')
        {
//            res.render("show_customers",{ 
//                title : "Mostrando listado de Customers", 
//                customers : data
//            });
            res.json(200, data);
        }
        //en otro caso mostramos un error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});

/* Mostramos el formulario para crear usuarios nuevos */
router.get('/customer', function (req, res)
{
    res.render('new_customer', {title: 'Servicio rest con nodejs, express 4 y mysql'});
});

/* Creamos un nuevo customer */
router.post("/customer", function (req, res)
{
    //creamos un objeto con los datos a insertar del customer
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
        //si el customer se ha insertado correctamente mostramos su info
        if (data && data.insertId)
        {
            //res.redirect("/customers/customer/" + data.insertId);
            res.json(200, {"insertId": data.insertId});
        } else
        {
            res.json(500, {"msg": "Error"});
        }
    });
});

/* Actualizamos un customer existente */
router.put('/customer/', function (req, res)
{
    //almacenamos los datos del formulario en un objeto
    var customerData = {id: req.param('id'), name: req.param('name'), email: req.param('email'), cif: req.param('cif'), address: req.param('address'), telephone: req.param('telephone'), web: req.param('web')};
    CustomerModel.updateCustomer(customerData, function (error, data)
    {
        //si el customer se ha actualizado correctamente mostramos un mensaje
        if (data && data.msg)
        {
            //res.redirect("/customers/customer/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": "Error"});
        }
    });
});

/* Obtenemos un customer por su id y lo mostramos en un formulario para editar */
router.get('/customer/:id', function (req, res)
{
    var id = req.params.id;
    //solo actualizamos si la id es un número
    if (!isNaN(id))
    {
        CustomerModel.getCustomer(id, function (error, data)
        {
            //si existe el customer mostramos el formulario
            if (typeof data !== 'undefined' && data.length > 0)
            {
//                res.render("update_customer",{ 
//                    title : "Servicio rest con nodejs, express 4 y mysql", 
//                    info : data
//                });
                res.json(200, data);

            }
            //en otro caso mostramos un error
            else
            {
                res.json(404, {"msg": "notExist"});
            }
        });
    }
    //si la id no es numerica mostramos un error de servidor
    else
    {
        res.json(500, {"msg": "The id must be numeric"});
    }
});



/* ELiminamos un customer */
router.delete("/customer/", function (req, res)
{
    //id del customer a eliminar
    var id = req.param('id');
    CustomerModel.deleteCustomer(id, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/customers/");
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": "Error"});
        }
    });
});

module.exports = router;