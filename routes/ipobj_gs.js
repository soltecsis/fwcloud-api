var express = require('express');
var router = express.Router();
var Ipobj_gModel = require('../models/ipobj_g');

/**
* Property Logger to manage App logs
*
* @property logger
* @type log4js/app
* 
*/
var logger = require('log4js').getLogger("app");

/* get data para crear nuevos */
router.get('/ipobj-g', function (req, res)
{
    res.render('new_ipobj_g', {title: 'Crear nuevo ipobj_g'});
});

/* Get all ipobj_gs*/
router.get('/:fwcloud', function (req, res)
{
    var fwcloud = req.params.fwcloud;
    Ipobj_gModel.getIpobj_gs(fwcloud,function (error, data)
    {
        //If exists ipobj_g get data
        if (typeof data !== 'undefined')
        {
            res.status(200).json( {"data": data});
        }
        //Get Error
        else
        {
            res.status(404).json( {"msg": "notExist"});
        }
    });
});




/* Get  ipobj_g by id */
router.get('/:fwcloud/:id', function (req, res)
{    
    var id = req.params.id;
    var fwcloud = req.params.fwcloud;
    Ipobj_gModel.getIpobj_g(fwcloud,id,function (error, data)
    {
        //If exists ipobj_g get data
        if (typeof data !== 'undefined')
        {
            res.status(200).json( {"data": data});
        }
        //Get Error
        else
        {
            res.status(404).json( {"msg": "notExist"});
        }
    });
});

/* Get all ipobj_gs by nombre */
router.get('/:fwcloud/name/:name', function (req, res)
{
    var name = req.params.name;
    var fwcloud = req.params.fwcloud;
    Ipobj_gModel.getIpobj_gName(fwcloud,name,function (error, data)
    {
        //If exists ipobj_g get data
        if (typeof data !== 'undefined')
        {
            res.status(200).json( {"data": data});
        }
        //Get Error
        else
        {
            res.status(404).json( {"msg": "notExist"});
        }
    });
});

/* Get all ipobj_gs by tipo */
router.get('/:fwcloud/type/:type', function (req, res)
{
    var type = req.params.type;
    var fwcloud = req.params.fwcloud;
    Ipobj_gModel.getIpobj_gtype(fwcloud,type,function (error, data)
    {
        //If exists ipobj_g get data
        if (typeof data !== 'undefined')
        {
            res.status(200).json( {"data": data});
        }
        //Get Error
        else
        {
            res.status(404).json( {"msg": "notExist"});
        }
    });
});





/* Create New ipobj_g */
router.post("/ipobj-g", function (req, res)
{
    //Create New objet with data ipobj_g
    var ipobj_gData = {
        id: null,
        name: req.body.name,
        type: req.body.comment,
        fwcloud: req.body.fwcloud
    };
    
    Ipobj_gModel.insertIpobj_g(ipobj_gData, function (error, data)
    {
        //If saved ipobj_g Get data
        if (data && data.insertId)
        {
            //res.redirect("/ipobj-gs/ipobj-g/" + data.insertId);
            res.status(200).json( {"insertId": data.insertId});
        } else
        {
            res.status(500).json( {"msg": error});
        }
    });
});

/* Update ipobj_g that exist */
router.put('/ipobj-g/', function (req, res)
{
    //Save data into object
    var ipobj_gData = {id: req.param('id'), name: req.param('name'), firewall: req.param('firewall'), comment: req.param('comment'),fwcloud: req.param('fwcloud')};
    Ipobj_gModel.updateIpobj_g(ipobj_gData, function (error, data)
    {
        //If saved ipobj_g saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/ipobj-gs/ipobj-g/" + req.param('id'));
            res.status(200).json( data.msg);
        } else
        {
            res.status(500).json( {"msg": error});
        }
    });
});



/* Remove ipobj_g */
router.delete("/ipobj-g/", function (req, res)
{
    //Id from ipobj_g to remove
    var idfirewall = req.param('idfirewall');
    var id = req.param('id');
    Ipobj_gModel.deleteIpobj_gidfirewall(idfirewall,id, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/ipobj-gs/");
            res.status(200).json( data.msg);
        } else
        {
            res.status(500).json( {"msg": error});
        }
    });
});

module.exports = router;