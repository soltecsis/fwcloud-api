var express = require('express');
var router = express.Router();
var IpobjModel = require('../models/ipobj');

var isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.redirect('/');
};

//router.get('/*',isAuthenticated, function (req, res, next){
//    return next();
//});

/* Mostramos el formulario para crear usuarios nuevos */
router.get('/ipobj', function (req, res)
{
    res.render('new_ipobj', {title: 'Crear nuevo ipobj'});
});

/* Obtenemos y mostramos todos los ipobjs por  grupo*/
router.get('/group/:idgroup', function (req, res)
{    
    var idgroup = req.params.idgroup;
    IpobjModel.getIpobjsGroup(idgroup,function (error, data)
    {
        //si existe el ipobj mostramos el formulario
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

/* Obtenemos y mostramos todos los ipobjs por  grupo e id*/
router.get('/group/:idgroup/:id', function (req, res)
{    
    var idgroup = req.params.idgroup;
    var id = req.params.id;
    
    IpobjModel.getIpobjsGroup(idgroup,id,function (error, data)
    {
        //si existe el ipobj mostramos el formulario
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


/* Obtenemos y mostramos  ipobj por id  */
router.get('/:id', function (req, res)
{
    var id = req.params.id;
    IpobjModel.getIpobj(id,function (error, data)
    {
        //si existe el ipobj mostramos el formulario
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

/* Obtenemos y mostramos todos los ipobjs por nombre y por grupo*/
router.get('/group/:idgroup/name/:name', function (req, res)
{
    var name = req.params.name;
    var idgroup = req.params.idgroup;
    IpobjModel.getIpobjName(idgroup,name,function (error, data)
    {
        //si existe el ipobj mostramos el formulario
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





/* Creamos un nuevo ipobj */
router.post("/ipobj", function (req, res)
{
    //creamos un objeto con los datos a insertar del ipobj
    var ipobjData = {
        id: null,
        fwcloud: req.body.fwcloud,
        interface: req.body.interface,
        name: req.body.name,
        type: req.body.type,
        protocol: req.body.protocol,
        address: req.body.address,
        netmask: req.body.netmask,
        diff_serv: req.body.diff_serv,
        ip_version: req.body.ip_version,
        code: req.body.code,
        tcp_flags_mask: req.body.tcp_flags_mask,
        tcp_flags_settings: req.body.tcp_flags_settings,
        range_start: req.body.range_start,
        range_end: req.body.range_end,
        source_port_start: req.body.source_port_start,
        source_port_end: req.body.source_port_end,
        destination_port_start: req.body.destination_port_start,
        destination_port_end: req.body.destination_port_end,       
        options: req.body.options,
        comment: req.body.comment
    };
    
    IpobjModel.insertIpobj(ipobjData, function (error, data)
    {
        //si el ipobj se ha insertado correctamente mostramos su info
        if (data && data.insertId)
        {
            //res.redirect("/ipobjs/ipobj/" + data.insertId);
            res.json(200, {"insertId": data.insertId});
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Actualizamos un ipobj existente */
router.put('/ipobj/', function (req, res)
{
    //almacenamos los datos del formulario en un objeto
    var ipobjData = {id: req.param('id'),fwcloud: req.param('fwcloud'),  interface: req.param('interface'), name: req.param('name'), type: req.param('type'), protocol: req.param('protocol'), address: req.param('address'),  netmask: req.param('netmask'), diff_serv: req.param('diff_serv'), ip_version: req.param('ip_version'), code: req.param('code'), tcp_flags_mask: req.param('tcp_flags_mask'), tcp_flags_settings: req.param('tcp_flags_settings'),range_start: req.param('range_start'), range_end: req.param('range_end'),source_port_start: req.param('source_port_start'), source_port_end: req.param('source_port_end'),destination_port_start: req.param('destination_port_start'), destination_port_end: req.param('destination_port_end'), options: req.param('options'), comment: req.param('comment')};
    IpobjModel.updateIpobj(ipobjData, function (error, data)
    {
        //si el ipobj se ha actualizado correctamente mostramos un mensaje
        if (data && data.msg)
        {
            //res.redirect("/ipobjs/ipobj/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});



/* ELiminamos un ipobj */
router.delete("/ipobj/", function (req, res)
{
    //id del ipobj a eliminar
    var idfirewall = req.param('idfirewall');
    var id = req.param('id');
    IpobjModel.deleteIpobj(idfirewall,id, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/ipobjs/");
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

module.exports = router;