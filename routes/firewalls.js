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

/* Show form */
router.get('/firewall', function (req, res)
{
    res.render('new_firewall', {title: 'Crear nuevo firewall'});
});

/* Get firewall by User*/
router.get('/:iduser', function (req, res)
{
    var iduser = req.params.iduser;
    FirewallModel.getFirewalls(iduser,function (error, data)
    {
        //Get data
        if (typeof data !== 'undefined')
        {
            res.json(200, {"data": data});
        }
        //Get error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});

/* Get firewall by id and user*/
router.get('/:iduser/:id', function (req, res)
{
    var iduser = req.params.iduser;
    var id = req.params.id;
    FirewallModel.getFirewall(iduser,id,function (error, data)
    {
        //Get Data
        if (typeof data !== 'undefined')
        {
            res.json(200, {"data": data});
        }
        //get Error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});

/* Get firewalls by firewall name and User*/
router.get('/:iduser/fwname/:name', function (req, res)
{
    var iduser = req.params.iduser;
    var name = req.params.name;
    FirewallModel.getFirewallName(iduser,name,function (error, data)
    {
        //Get data
        if (typeof data !== 'undefined')
        {
            res.json(200, {"data": data});
        }
        //Get error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});

/* Get firewalls by cluster */
router.get('/:iduser/cluster/:idcluster', function (req, res)
{
    var iduser = req.params.iduser;
    var idcluster = req.params.idcluster;
    FirewallModel.getFirewallCluster(iduser,idcluster,function (error, data)
    {
        //get data
        if (typeof data !== 'undefined')
        {
            res.json(200, {"data": data});
        }
        //Get Error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});



/* New firewall */
router.post("/firewall", function (req, res)
{
    
    var firewallData = {
        id: null,
        cluster: req.body.cluster,
        name: req.body.name,
        comment: req.body.comment
    };
    var iduser= req.body.iduser;
    FirewallModel.insertFirewall(iduser, firewallData, function (error, data)
    {
        
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

/* Update firewall */
router.put('/firewall/', function (req, res)
{
    //Save firewall data into objet
    var firewallData = {id: req.param('id'), name: req.param('name'), cluster: req.param('cluster'), user: req.param('user'), comment: req.param('comment')};
    FirewallModel.updateFirewall(firewallData, function (error, data)
    {
        //Saved ok
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

/* Get firewall by Id */
router.get('/:iduser/firewall/:id', function (req, res)
{
    var id = req.params.id;
    var iduser = req.params.iduser;
    
    if (!isNaN(id))
    {
        FirewallModel.getFirewall(iduser,id, function (error, data)
        {
            //get firewall data
            if (typeof data !== 'undefined' && data.length > 0)
            {
//                res.render("update_firewall",{ 
//                    title : "Servicio rest con nodejs, express 4 y mysql", 
//                    info : data
//                });
                res.json(200, {"data": data});

            }
            //get error
            else
            {
                res.json(404, {"msg": "notExist"});
            }
        });
    }
    //id must be numeric
    else
    {
        res.json(500, {"msg": "The id must be numeric"});
    }
});

/* Get firewall by firewall name  */
router.get('/:iduser/firewall/name/:name', function (req, res)
{
    var iduser = req.params.iduser;
    var name = req.params.name;
    
    if (name.length>0)
    {
        FirewallModel.getFirewallName(iduser,name, function (error, data)
        {
            //get data
            if (typeof data !== 'undefined' && data.length > 0)
            {
                res.json(200, {"data": data});

            }
            //get error
            else
            {
                res.json(404, {"msg": "notExist"});
            }
        });
    }
    //id must be numeric
    else
    {
        res.json(500, {"msg": "The id must be numeric"});
    }
});



/* remove firewall */
router.delete("/firewall/", function (req, res)
{
    
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