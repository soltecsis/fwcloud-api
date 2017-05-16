var express = require('express');
var router = express.Router();
var FirewallModel = require('../models/firewall');

var isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.redirect('/');
};

//router.get('/*',isAuthenticated, function (req, res, next){
//    return next();
//});

/* Mostramos el formulario para crear usuarios nuevos */
router.get('/firewall', function (req, res)
{
    res.render('new_firewall', {title: 'Crear nuevo firewall'});
});

/* Obtenemos y mostramos todos los firewalls por usuario*/
router.get('/:iduser', function (req, res)
{
    var iduser = req.params.iduser;
    FirewallModel.getFirewalls(iduser,function (error, data)
    {
        //si existe el firewall mostramos el formulario
        if (typeof data !== 'undefined')
        {
            res.json(200, {"data": data});
        }
        //en otro caso mostramos un error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});

/* Obtenemos y mostramos  firewall por id y  por usuario*/
router.get('/:iduser/:id', function (req, res)
{
    var iduser = req.params.iduser;
    var id = req.params.id;
    FirewallModel.getFirewall(iduser,id,function (error, data)
    {
        //si existe el firewall mostramos el formulario
        if (typeof data !== 'undefined')
        {
            res.json(200, {"data": data});
        }
        //en otro caso mostramos un error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});

/* Obtenemos y mostramos todos los firewalls por nombre y por usuario*/
router.get('/:iduser/fwname/:name', function (req, res)
{
    var iduser = req.params.iduser;
    var name = req.params.name;
    FirewallModel.getFirewallName(iduser,name,function (error, data)
    {
        //si existe el firewall mostramos el formulario
        if (typeof data !== 'undefined')
        {
            res.json(200, {"data": data});
        }
        //en otro caso mostramos un error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});

/* Obtenemos y mostramos todos los firewalls por nombre y por usuario*/
router.get('/:iduser/cluster/:idcluster', function (req, res)
{
    var iduser = req.params.iduser;
    var idcluster = req.params.idcluster;
    FirewallModel.getFirewallCluster(iduser,idcluster,function (error, data)
    {
        //si existe el firewall mostramos el formulario
        if (typeof data !== 'undefined')
        {
            res.json(200, {"data": data});
        }
        //en otro caso mostramos un error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});



/* Creamos un nuevo firewall */
router.post("/firewall", function (req, res)
{
    //creamos un objeto con los datos a insertar del firewall
    var firewallData = {
        id: null,
        cluster: req.body.cluster,
        name: req.body.name,
        comment: req.body.comment
    };
    var iduser= req.body.iduser;
    FirewallModel.insertFirewall(iduser, firewallData, function (error, data)
    {
        //si el firewall se ha insertado correctamente mostramos su info
        if (data && data.insertId)
        {
            //res.redirect("/firewalls/firewall/" + data.insertId);
            res.json(200, {"insertId": data.insertId});
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Actualizamos un firewall existente */
router.put('/firewall/', function (req, res)
{
    //almacenamos los datos del formulario en un objeto
    var firewallData = {id: req.param('id'), name: req.param('name'), cluster: req.param('cluster'), user: req.param('user'), comment: req.param('comment')};
    FirewallModel.updateFirewall(firewallData, function (error, data)
    {
        //si el firewall se ha actualizado correctamente mostramos un mensaje
        if (data && data.msg)
        {
            //res.redirect("/firewalls/firewall/" + req.param('id'));
            res.json(200, {"data": data}.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Obtenemos un firewall por su id y lo mostramos en un formulario para editar */
router.get('/:iduser/firewall/:id', function (req, res)
{
    var id = req.params.id;
    var iduser = req.params.iduser;
    //solo actualizamos si la id es un número
    if (!isNaN(id))
    {
        FirewallModel.getFirewall(iduser,id, function (error, data)
        {
            //si existe el firewall mostramos el formulario
            if (typeof data !== 'undefined' && data.length > 0)
            {
//                res.render("update_firewall",{ 
//                    title : "Servicio rest con nodejs, express 4 y mysql", 
//                    info : data
//                });
                res.json(200, {"data": data});

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

/* Obtenemos un firewall por su name y  */
router.get('/:iduser/firewall/name/:name', function (req, res)
{
    var iduser = req.params.iduser;
    var name = req.params.name;
    //solo actualizamos si la id es un número
    if (name.length>0)
    {
        FirewallModel.getFirewallName(iduser,name, function (error, data)
        {
            //si existe el firewall mostramos el formulario
            if (typeof data !== 'undefined' && data.length > 0)
            {
                res.json(200, {"data": data});

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



/* ELiminamos un firewall */
router.delete("/firewall/", function (req, res)
{
    //id del firewall a eliminar
    var id = req.param('id');
    var iduser = req.param('iduser');
    FirewallModel.deleteFirewall(iduser,id, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/firewalls/");
            res.json(200, {"data": data}.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

module.exports = router;