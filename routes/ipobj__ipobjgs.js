var express = require('express');
var router = express.Router();
var Ipobj__ipobjgModel = require('../models/ipobj__ipobjg');

var isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.redirect('/');
};

router.get('/*',isAuthenticated, function (req, res, next){
    return next();
});

/* Mostramos el formulario para crear nuevos */
router.get('/ipobj__ipobjg', function (req, res)
{
    res.render('new_ipobj__ipobjg', {title: 'Crear nuevo ipobj__ipobjg'});
});

/* Obtenemos y mostramos todos los ipobj__ipobjgs por grupo*/
router.get('/:ipobjg', function (req, res)
{
    var ipobjg = req.params.ipobjg;
    Ipobj__ipobjgModel.getIpobj__ipobjgs(ipobjg,function (error, data)
    {
        //si existe el ipobj__ipobjg mostramos el formulario
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



/* Obtenemos y mostramos  ipobj__ipobjg por id */
router.get('/:ipobjg/:ipobj', function (req, res)
{    
    var ipobjg = req.params.ipobjg;
    var ipobj = req.params.ipobj;
    Ipobj__ipobjgModel.getIpobj__ipobjg(ipobjg, ipobj,function (error, data)
    {
        //si existe el ipobj__ipobjg mostramos el formulario
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


/* Creamos un nuevo ipobj__ipobjg */
router.post("/ipobj__ipobjg", function (req, res)
{
    //creamos un objeto con los datos a insertar del ipobj__ipobjg
    var ipobj__ipobjgData = {
        ipobj_g: req.body.ipobj_g,
        ipobj: req.body.ipobj
    };
    
    Ipobj__ipobjgModel.insertIpobj__ipobjg(ipobj__ipobjgData, function (error, data)
    {
        //si el ipobj__ipobjg se ha insertado correctamente mostramos su info
        if (data && data.msg)
        {
            //res.redirect("/ipobj__ipobjgs/ipobj__ipobjg/" + data.insertId);
            res.json(200, {"msg": data.msg});
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Actualizamos un ipobj__ipobjg existente */
router.put('/ipobj__ipobjg/:ipobjg/:ipobj', function (req, res)
{
    var ipobjg = req.params.ipobjg;
    var ipobj = req.params.ipobj;
    //almacenamos los datos del formulario en un objeto
    var ipobj__ipobjgData = {ipobj_g: req.param('new_ipobj_g'), ipobj: req.param('new_ipobj') };
    Ipobj__ipobjgModel.updateIpobj__ipobjg(ipobjg, ipobj,ipobj__ipobjgData, function (error, data)
    {
        //si el ipobj__ipobjg se ha actualizado correctamente mostramos un mensaje
        if (data && data.msg)
        {
            //res.redirect("/ipobj__ipobjgs/ipobj__ipobjg/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});



/* ELiminamos un ipobj__ipobjg */
router.delete("/ipobj__ipobjg/", function (req, res)
{
    //id del ipobj__ipobjg a eliminar
    var ipobjg = req.params.ipobjg;
    var ipobj = req.params.ipobj;
    Ipobj__ipobjgModel.deleteIpobj__ipobjgidfirewall(ipobjg,ipobj, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/ipobj__ipobjgs/");
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

module.exports = router;