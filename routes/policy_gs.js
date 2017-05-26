var express = require('express');
var router = express.Router();
var Policy_gModel = require('../models/policy_g');

var isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.redirect('/');
};

router.get('/*',isAuthenticated, function (req, res, next){
    return next();
});

/* get data para crear nuevos */
router.get('/policy-g', function (req, res)
{
    res.render('new_policy_g', {title: 'Crear nuevo policy_g'});
});

/* Get all policy_gs by firewall*/
router.get('/:idfirewall', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    Policy_gModel.getPolicy_gs(idfirewall,function (error, data)
    {
        //If exists policy_g get data
        if (typeof data !== 'undefined')
        {
            res.json(200, data);
        }
        //Get Error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});

/* Get all policy_gs by firewall and group father*/
router.get('/:idfirewall/group/:idgroup', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var idgroup = req.params.idgroup;
    Policy_gModel.getPolicy_gs_group(idfirewall,idgroup,function (error, data)
    {
        //If exists policy_g get data
        if (typeof data !== 'undefined')
        {
            res.json(200, data);
        }
        //Get Error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});

/* Get  policy_g by id and  by firewall*/
router.get('/:idfirewall/:id', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var id = req.params.id;
    Policy_gModel.getPolicy_g(idfirewall,id,function (error, data)
    {
        //If exists policy_g get data
        if (typeof data !== 'undefined')
        {
            res.json(200, data);
        }
        //Get Error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});

/* Get all policy_gs by nombre and by firewall*/
router.get('/:idfirewall/name/:name', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var name = req.params.name;
    Policy_gModel.getPolicy_gName(idfirewall,name,function (error, data)
    {
        //If exists policy_g get data
        if (typeof data !== 'undefined')
        {
            res.json(200, data);
        }
        //Get Error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});





/* Create New policy_g */
router.post("/policy-g", function (req, res)
{
    //Create New objet with data policy_g
    var policy_gData = {
        id: null,
        firewall: req.body.firewall,
        name: req.body.name,
        comment: req.body.comment
    };
    
    Policy_gModel.insertPolicy_g(policy_gData, function (error, data)
    {
        //If saved policy_g Get data
        if (data && data.insertId)
        {
            //res.redirect("/policy-gs/policy-g/" + data.insertId);
            res.json(200, {"insertId": data.insertId});
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Update policy_g that exist */
router.put('/policy-g/', function (req, res)
{
    //Save data into object
    var policy_gData = {id: req.param('id'), name: req.param('name'), firewall: req.param('firewall'), comment: req.param('comment')};
    Policy_gModel.updatePolicy_g(policy_gData, function (error, data)
    {
        //If saved policy_g saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/policy-gs/policy-g/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});



/* Remove policy_g */
router.delete("/policy-g/", function (req, res)
{
    //Id from policy_g to remove
    var idfirewall = req.param('idfirewall');
    var id = req.param('id');
    Policy_gModel.deletePolicy_gidfirewall(idfirewall,id, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/policy-gs/");
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

module.exports = router;