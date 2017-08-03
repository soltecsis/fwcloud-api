var express = require('express');
var router = express.Router();
var Ipobj__ipobjgModel = require('../models/ipobj__ipobjg');


/* get data para crear nuevos */
router.get('/ipobj__ipobjg', function (req, res)
{
    res.render('new_ipobj__ipobjg', {title: 'Crear nuevo ipobj__ipobjg'});
});

/* Get all ipobj__ipobjgs by group*/
router.get('/:ipobjg', function (req, res)
{
    var ipobjg = req.params.ipobjg;
    Ipobj__ipobjgModel.getIpobj__ipobjgs(ipobjg,function (error, data)
    {
        //If exists ipobj__ipobjg get data
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



/* Get  ipobj__ipobjg by id */
router.get('/:ipobjg/:ipobj', function (req, res)
{    
    var ipobjg = req.params.ipobjg;
    var ipobj = req.params.ipobj;
    Ipobj__ipobjgModel.getIpobj__ipobjg(ipobjg, ipobj,function (error, data)
    {
        //If exists ipobj__ipobjg get data
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


/* Create New ipobj__ipobjg */
router.post("/ipobj__ipobjg", function (req, res)
{
    //Create New objet with data ipobj__ipobjg
    var ipobj__ipobjgData = {
        ipobj_g: req.body.ipobj_g,
        ipobj: req.body.ipobj
    };
    
    Ipobj__ipobjgModel.insertIpobj__ipobjg(ipobj__ipobjgData, function (error, data)
    {
        //If saved ipobj__ipobjg Get data
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

/* Update ipobj__ipobjg that exist */
router.put('/ipobj__ipobjg/:ipobjg/:ipobj', function (req, res)
{
    var ipobjg = req.params.ipobjg;
    var ipobj = req.params.ipobj;
    //Save data into object
    var ipobj__ipobjgData = {ipobj_g: req.param('new_ipobj_g'), ipobj: req.param('new_ipobj') };
    Ipobj__ipobjgModel.updateIpobj__ipobjg(ipobjg, ipobj,ipobj__ipobjgData, function (error, data)
    {
        //If saved ipobj__ipobjg saved ok, get data
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



/* Remove ipobj__ipobjg */
router.delete("/ipobj__ipobjg/", function (req, res)
{
    //Id from ipobj__ipobjg to remove
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