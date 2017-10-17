var express = require('express');
var router = express.Router();
var Ipobj_gModel = require('../models/ipobj_g');
var fwcTreemodel = require('../models/fwc_tree');
var Ipobj__ipobjgModel = require('../models/ipobj__ipobjg');


/**
 * Property Logger to manage App logs
 *
 * @property logger
 * @type log4js/app
 * 
 */
var logger = require('log4js').getLogger("app");


/* Get all ipobj_gs*/
router.get('/:iduser/:fwcloud', function (req, res)
{
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;
    Ipobj_gModel.getIpobj_g_Full(fwcloud,'', function (error, data)
    {
        //If exists ipobj_g get data
        if (typeof data !== 'undefined')
        {
            res.status(200).json({"data": data});
        }
        //Get Error
        else
        {
            res.status(404).json({"msg": "notExist"});
        }
    });
});



/* Get  ipobj_g by id */
router.get('/:iduser/:fwcloud/:id', function (req, res)
{
    var id = req.params.id;
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;
    Ipobj_gModel.getIpobj_g_Full(fwcloud, id, function (error, data)
    {
        //If exists ipobj_g get data
        if (typeof data !== 'undefined')
        {
            res.status(200).json({"data": data});
        }
        //Get Error
        else
        {
            res.status(404).json({"msg": "notExist"});
        }
    });
});


/* Get all ipobj_gs by nombre */
router.get('/:iduser/:fwcloud/name/:name', function (req, res)
{
    var iduser = req.params.iduser;
    var name = req.params.name;
    var fwcloud = req.params.fwcloud;
    Ipobj_gModel.getIpobj_gName(fwcloud, name, function (error, data)
    {
        //If exists ipobj_g get data
        if (typeof data !== 'undefined')
        {
            res.status(200).json({"data": data});
        }
        //Get Error
        else
        {
            res.status(404).json({"msg": "notExist"});
        }
    });
});

/* Get all ipobj_gs by tipo */
router.get('/:iduser/:fwcloud/type/:type', function (req, res)
{
    var iduser = req.params.iduser;
    var type = req.params.type;
    var fwcloud = req.params.fwcloud;
    Ipobj_gModel.getIpobj_gtype(fwcloud, type, function (error, data)
    {
        //If exists ipobj_g get data
        if (typeof data !== 'undefined')
        {
            res.status(200).json({"data": data});
        }
        //Get Error
        else
        {
            res.status(404).json({"msg": "notExist"});
        }
    });
});





/* Create New ipobj_g */
router.post("/ipobj-g/:iduser/:fwcloud/:node_parent/:node_order/:node_type", function (req, res)
{
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;
    var node_parent = req.params.node_parent;
    var node_order = req.params.node_order;
    var node_type = req.params.node_type;

    //Create New objet with data ipobj_g
    var ipobj_gData = {
        id: null,
        name: req.body.name,
        type: req.body.type,
        fwcloud: req.body.fwcloud,
        comment: req.body.comment
    };

    Ipobj_gModel.insertIpobj_g(ipobj_gData, function (error, data)
    {
        //If saved ipobj_g Get data
        if (data && data.insertId > 0)
        {
            var id = data.insertId;
            logger.debug("NEW IPOBJ GROUP id:" + id + "  Type:" + ipobj_gData.type + "  Name:" + ipobj_gData.name);
            ipobj_gData.id = id;
            //INSERT IN TREE
            fwcTreemodel.insertFwc_TreeOBJ(iduser, fwcloud, node_parent, node_order, node_type, ipobj_gData, function (error, data) {
                if (data && data.insertId) {
                    res.status(200).json({"insertId": data.insertId});
                } else {
                    logger.debug(error);
                    res.status(500).json({"msg": error});
                }
            });

        } else
        {
            res.status(500).json({"msg": error});
        }
    });
});

/* Update ipobj_g that exist */
router.put('/ipobj-g/', function (req, res)
{
    //Save data into object
    var ipobj_gData = {id: req.body.id, name: req.body.name, type: req.body.type, comment: req.body.comment, fwcloud: req.body.fwcloud};
    Ipobj_gModel.updateIpobj_g(ipobj_gData, function (error, data)
    {
        //If saved ipobj_g saved ok, get data
        if (data && data.msg)
        {
            res.status(200).json(data.msg);
        } else
        {
            res.status(500).json({"msg": error});
        }
    });
});

//FALTA CONTROL de RESTRICCION de BORRADO
/* Remove ipobj_g */
router.delete("/ipobj-g/:iduser/:fwcloud/:id/:type", function (req, res)
{
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;
    var id = req.params.id;
    var type = req.params.type;


    Ipobj_gModel.deleteIpobj_g(fwcloud, id, type, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            if (data.msg === "deleted") {
                Ipobj__ipobjgModel.deleteIpobj__ipobjgAll(id, function (error, data)
                {
                    if (data && data.msg === "deleted" || data.msg === "notExist")
                    {
                        //res.redirect("/ipobj__ipobjgs/");
                        res.status(200).json(data.msg);
                    } else
                    {
                        res.status(500).json({"msg": error});
                    }
                });
            } else
                res.status(200).json(data.msg);
        } else
        {
            res.status(500).json({"msg": error});
        }
    });
});

module.exports = router;