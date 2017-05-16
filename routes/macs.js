var express = require('express');
var router = express.Router();
var MacModel = require('../models/mac');

var isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.redirect('/');
};

router.get('/*',isAuthenticated, function (req, res, next){
    return next();
});

/* Mostramos el formulario para crear  nuevos */
router.get('/mac', function (req, res)
{
    res.render('new_mac', {title: 'Crear nuevo mac'});
});

/* Obtenemos y mostramos todos los macs por intreface*/
router.get('/:interface', function (req, res)
{
    var interface = req.params.interface;
    MacModel.getMacs(interface,function (error, data)
    {
        //si existe el mac mostramos el formulario
        if (typeof data !== 'undefined')
        {
            res.json(200, data);
        }
        //en otro caso mostramos un error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});

/* Obtenemos y mostramos  mac por id y  por interface*/
router.get('/:interface/:id', function (req, res)
{
    var interface = req.params.interface;
    var id = req.params.id;
    MacModel.getMac(interface,id,function (error, data)
    {
        //si existe el mac mostramos el formulario
        if (typeof data !== 'undefined')
        {
            res.json(200, data);
        }
        //en otro caso mostramos un error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});

/* Obtenemos y mostramos todos los macs por nombre y por interface*/
router.get('/:interface/name/:name', function (req, res)
{
    var interface = req.params.interface;
    var name = req.params.name;
    MacModel.getMacName(interface,name,function (error, data)
    {
        //si existe el mac mostramos el formulario
        if (typeof data !== 'undefined')
        {
            res.json(200, data);
        }
        //en otro caso mostramos un error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});

/* Obtenemos y mostramos todos los macs por address y por interface*/
router.get('/:interface/address/:address', function (req, res)
{
    var interface = req.params.interface;
    var address = req.params.address;
    MacModel.getMacAddress(interface,address,function (error, data)
    {
        //si existe el mac mostramos el formulario
        if (typeof data !== 'undefined')
        {
            res.json(200, data);
        }
        //en otro caso mostramos un error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});



/* Creamos un nuevo mac */
router.post("/mac", function (req, res)
{
    //creamos un objeto con los datos a insertar del mac
    var macData = {
        id: null,
        interface: req.body.interface,
        name: req.body.name,
        address: req.body.address,
        comment: req.body.comment
    };
    var interface= req.body.interface;
    MacModel.insertMac(interface, macData, function (error, data)
    {
        //si el mac se ha insertado correctamente mostramos su info
        if (data && data.insertId)
        {
            //res.redirect("/macs/mac/" + data.insertId);
            res.json(200, {"insertId": data.insertId});
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Actualizamos un mac existente */
router.put('/mac/', function (req, res)
{
    //almacenamos los datos del formulario en un objeto
    var macData = {id: req.param('id'), name: req.param('name'), interface: req.param('interface'), address: req.param('address'), comment: req.param('comment')};
    MacModel.updateMac(macData, function (error, data)
    {
        //si el mac se ha actualizado correctamente mostramos un mensaje
        if (data && data.msg)
        {
            //res.redirect("/macs/mac/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Obtenemos un mac por su id y lo mostramos en un formulario para editar */
router.get('/:interface/mac/:id', function (req, res)
{
    var id = req.params.id;
    var interface = req.params.interface;
    //solo actualizamos si la id es un número
    if (!isNaN(id))
    {
        MacModel.getMac(interface,id, function (error, data)
        {
            //si existe el mac mostramos el formulario
            if (typeof data !== 'undefined' && data.length > 0)
            {

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

/* Obtenemos un mac por su name y  */
router.get('/:interface/mac/name/:name', function (req, res)
{
    var interface = req.params.interface;
    var name = req.params.name;
    //solo actualizamos si la id es un número
    if (name.length>0)
    {
        MacModel.getMacName(interface,name, function (error, data)
        {
            //si existe el mac mostramos el formulario
            if (typeof data !== 'undefined' && data.length > 0)
            {
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



/* ELiminamos un mac */
router.delete("/mac/", function (req, res)
{
    //id del mac a eliminar
    var id = req.param('id');
    var interface = req.param('interface');
    MacModel.deleteMac(interface,id, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/macs/");
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

module.exports = router;