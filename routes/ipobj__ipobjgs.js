var express = require('express');
var router = express.Router();
var Ipobj__ipobjgModel = require('../models/ipobj__ipobjg');
var fwcTreemodel = require('../models/fwc_tree');
var IpobjModel = require('../models/ipobj');

/**
 * Property Logger to manage App logs
 *
 * @property logger
 * @type log4js/app
 * 
 */
var logger = require('log4js').getLogger("app");

/* get data para crear nuevos */
router.get('/ipobj__ipobjg', function (req, res)
{
    res.render('new_ipobj__ipobjg', {title: 'Crear nuevo ipobj__ipobjg'});
});

/* Get all ipobj__ipobjgs by group*/
router.get('/:ipobjg', function (req, res)
{
    var ipobjg = req.params.ipobjg;
    Ipobj__ipobjgModel.getIpobj__ipobjgs(ipobjg, function (error, data)
    {
        //If exists ipobj__ipobjg get data
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



/* Get  ipobj__ipobjg by id */
router.get('/:ipobjg/:ipobj', function (req, res)
{
    var ipobjg = req.params.ipobjg;
    var ipobj = req.params.ipobj;
    Ipobj__ipobjgModel.getIpobj__ipobjg(ipobjg, ipobj, function (error, data)
    {
        //If exists ipobj__ipobjg get data
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


/* Create New ipobj__ipobjg */
router.post("/ipobj__ipobjg/:iduser/:fwcloud/:node_parent/:node_order/:node_type", function (req, res)
{
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;
    var node_parent = req.params.node_parent;
    var node_order = req.params.node_order;
    var node_type = req.params.node_type;

    //Create New object with data ipobj__ipobjg
    var ipobj__ipobjgData = {
        ipobj_g: req.body.ipobj_g,
        ipobj: req.body.ipobj
    };

    Ipobj__ipobjgModel.insertIpobj__ipobjg(ipobj__ipobjgData, function (error, data)
    {
        //If saved ipobj__ipobjg Get data
        if (data && data.insertId > 0)
        {
            logger.debug("NEW IPOBJ IN GROUP: " + ipobj__ipobjgData.ipobj_g + "  IPOBJ:" + ipobj__ipobjgData.ipobj);
            //Search IPOBJ Data
            IpobjModel.getIpobjGroup(fwcloud, ipobj__ipobjgData.ipobj_g, ipobj__ipobjgData.ipobj, function (error, dataIpobj)
            {
                //If exists ipobj get data
                if (typeof dataIpobj !== 'undefined')
                {

                    var NodeData = {
                        id: ipobj__ipobjgData.ipobj,
                        name: dataIpobj.name,
                        type: dataIpobj.type,
                        comment: dataIpobj.comment
                    };

                    //INSERT IN TREE
                    fwcTreemodel.insertFwc_TreeOBJ(iduser, fwcloud, node_parent, node_order, node_type, NodeData, function (error, data2) {
                        if (data2 && data2.insertId) {
                            res.status(200).json({"msg": "success"});
                        } else {
                            logger.debug(error);
                            res.status(500).json({"msg": error});
                        }
                    });
                }
                //Get Error
                else
                {
                    res.status(404).json({"msg": "notExist"});
                }
            });

        } else
        {
            res.status(500).json({"msg": error});
        }
    });
});

/* Update ipobj__ipobjg that exist */
router.put('/ipobj__ipobjg/:ipobjg/:ipobj', function (req, res)
{
    var ipobjg = req.params.ipobjg;
    var ipobj = req.params.ipobj;
    //Save data into object
    var ipobj__ipobjgData = {ipobj_g: req.param('new_ipobj_g'), ipobj: req.param('new_ipobj')};
    Ipobj__ipobjgModel.updateIpobj__ipobjg(ipobjg, ipobj, ipobj__ipobjgData, function (error, data)
    {
        //If saved ipobj__ipobjg saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/ipobj__ipobjgs/ipobj__ipobjg/" + req.param('id'));
            res.status(200).json(data.msg);
        } else
        {
            res.status(500).json({"msg": error});
        }
    });
});



/* Remove ipobj__ipobjg */
router.delete("/ipobj__ipobjg/:iduser/:fwcloud/:node_parent/:ipobjg/:ipobj/:type", function (req, res)
{
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;
    var node_parent = req.params.node_parent;

    //Id from ipobj__ipobjg to remove
    var ipobjg = req.params.ipobjg;
    var ipobj = req.params.ipobj;
    var type = req.params.type;

    Ipobj__ipobjgModel.deleteIpobj__ipobjg(ipobjg, ipobj, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            if (data.msg === "deleted") {
                //DELETE FROM TREE
                fwcTreemodel.deleteFwc_TreeGroupChild(iduser, fwcloud, node_parent, ipobj, function (error, data) {
                    if (data && data.msg) {
                        fwcTreemodel.orderTreeNode(fwcloud, node_parent, function (error, data) {
                             res.status(200).json({"msg": "deleted"});
                        });
                    } else {
                        logger.debug(error);
                        res.status(500).json({"msg": error});
                    }
                });

            } else
                res.status(404).json({"msg": "notExist"});
        } else
        {
            res.status(500).json({"msg": error});
        }
    });
});

module.exports = router;