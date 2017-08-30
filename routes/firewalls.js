var express = require('express');

/**
* Module to routing Firewalls requests
* <br>BASE ROUTE CALL: <b>/firewalls</b>
*
* @module FirewallRouter
* 
* @requires express
* @requires FirewallModel
* 
*/
var router = express.Router();

/**
* Property Model to manage Firewall Data
*
* @property FirewallModel
* @type /models/firewall
* 
*/
var FirewallModel = require('../models/firewall');


/**
* Class to manage firewalls routing
*
* @class FirewallRouter
* @uses FirewallModel
* 
*/

/**
* Show form to add new Firewall
* 
* <br>ROUTE CALL:  /firewall
*
* @method showForm
* 
* @return {Boolean} Returns true on success
*/
router.get('/firewall', function (req, res)
{
    res.render('new_firewall', {title: 'Crear nuevo firewall'});
});


/**
* Get Firewalls by User
* 
* 
* > ROUTE CALL:  __/firewalls/:iduser__      
* > METHOD:  __GET__
* 
* @method getFirewallByUser
* 
* @param {Integer} iduser User identifier
* 
* @return {JSON} Returns `JSON` Data from Firewall
* @example #### JSON RESPONSE
*    
*       {"data" : [
*          {  //Data Firewall 1       
*           "id" : ,            //Firewall Identifier
*           "cluster" : ,       //Cluster
*           "fwcloud" : ,       //Id Firewall cloud
*           "name" : ,          //Firewall name
*           "comment" : ,       //comment
*           "created_at" : ,    //Date Created
*           "updated_at" : ,    //Date Updated
*           "by_user" : ,       //User last update
*           "id_fwb" :          //ID firewall in FWbuilder
*          },
*          {....}, //Data Firewall 2
*          {....}  //Data Firewall ...n 
*         ]
*       };
* 
*/
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


/**
* Get Firewalls by User and ID
* 
* 
* > ROUTE CALL:  __/firewalls/:iduser/:id__      
* > METHOD:  __GET__
* 
* @method getFirewallByUser_and_Id
* 
* @param {Integer} iduser User identifier
* @param {Integer} id firewall identifier
* 
* @return {JSON} Returns `JSON` Data from Firewall
* @example #### JSON RESPONSE
*    
*       {"data" : [
*          {  //Data Firewall        
*           "id" : ,            //Firewall Identifier
*           "cluster" : ,       //Cluster
*           "fwcloud" : ,       //Id Firewall cloud
*           "name" : ,          //Firewall name
*           "comment" : ,       //comment
*           "created_at" : ,    //Date Created
*           "updated_at" : ,    //Date Updated
*           "by_user" : ,       //User last update
*           "id_fwb" :          //ID firewall in FWbuilder
*          }
*         ]
*       };
* 
*/
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



/**
* Get Firewalls by User and Name
* 
* 
* > ROUTE CALL:  __/firewalls/:iduser/fwname/:name__      
* > METHOD:  __GET__
* 
* @method getFirewallByUser_and_Name
* 
* @param {Integer} iduser User identifier
* @param {String} name firewall name
* 
* @return {JSON} Returns `JSON` Data from Firewall
* @example #### JSON RESPONSE
*    
*       {"data" : [
*          {  //Data Firewall 1       
*           "id" : ,            //Firewall Identifier
*           "cluster" : ,       //Cluster
*           "fwcloud" : ,       //Id Firewall cloud
*           "name" : ,          //Firewall name
*           "comment" : ,       //comment
*           "created_at" : ,    //Date Created
*           "updated_at" : ,    //Date Updated
*           "by_user" : ,       //User last update
*           "id_fwb" :          //ID firewall in FWbuilder
*          },
*          {....}, //Data Firewall 2
*          {....}  //Data Firewall ...n 
*         ]
*       };
* 
*/
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



/**
* Get Firewalls by Cluster
* 
* 
* > ROUTE CALL:  __/firewalls/:iduser/cluster/:idcluster__      
* > METHOD:  __GET__
* 
* @method getFirewallByUser_and_Cluster
* 
* @param {Integer} iduser User identifier
* @param {Number} idcluster Cluster identifier
* 
* @return {JSON} Returns `JSON` Data from Firewall
* @example #### JSON RESPONSE
*    
*       {"data" : [
*          {  //Data Firewall 1       
*           "id" : ,            //Firewall Identifier
*           "cluster" : ,       //Cluster
*           "fwcloud" : ,       //Id Firewall cloud
*           "name" : ,          //Firewall name
*           "comment" : ,       //comment
*           "created_at" : ,    //Date Created
*           "updated_at" : ,    //Date Updated
*           "by_user" : ,       //User last update
*           "id_fwb" :          //ID firewall in FWbuilder
*          },
*          {....}, //Data Firewall 2
*          {....}  //Data Firewall ...n 
*         ]
*       };
* 
*/
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




/**
* CREATE New firewall
* 
* 
* > ROUTE CALL:  __/firewalls/firewall__      
* > METHOD:  __POST__
* 
*
* @method AddFirewall
* 
* @param {Integer} id Firewall identifier (AUTO)
* @param {Integer} iduser User identifier
* @param {Integer} cluster Cluster identifier
* @param {String} name Firewall Name
* @param {String} [comment] Firewall comment
* 
* @return {JSON} Returns Json result
* @example 
* #### JSON RESPONSE OK:
*    
*       {"data" : [
*          { 
*           "insertId : ID,   //firewall identifier           
*          }
*         ]
*       };
*       
* #### JSON RESPONSE ERROR:
*    
*       {"data" : [
*          { 
*           "msg : ERROR,   //Text Error
*          }
*         ]
*       };
*/
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


/**
* UPDATE firewall
* 
* 
* > ROUTE CALL:  __/firewalls/firewall__      
* > METHOD:  __PUT__
* 
*
* @method UpdateFirewall
* 
* @param {Integer} id Firewall identifier
* @optional
* @param {Integer} iduser User identifier
* @param {Integer} cluster Cluster identifier
* @param {String} name Firewall Name
* @param {String} comment Firewall comment
* 
* @return {JSON} Returns Json result
* @example 
* #### JSON RESPONSE OK:
*    
*       {"data" : [
*          { 
*           "msg : "success",   //result
*          }
*         ]
*       };
*       
* #### JSON RESPONSE ERROR:
*    
*       {"data" : [
*          { 
*           "msg : ERROR,   //Text Error
*          }
*         ]
*       };
*/
router.put('/firewall/', function (req, res)
{
    //Save firewall data into objet
    var firewallData = {id: req.body.id, name: req.body.name, cluster: req.body.cluster, user: req.body.user, comment: req.body.comment };
    FirewallModel.updateFirewall(firewallData, function (error, data)
    {
        //Saved ok
        if (data && data.msg)
        {
            //res.redirect("/firewalls/firewall/" + req.param('id'));
            res.json(200, {"data": data.msg});
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Get firewall by Id */
/**
* Get Firewalls by ID and User
* 
* <br>ROUTE CALL:  <b>/firewalls/:iduser/firewall/:id</b>
* <br>METHOD: <b>GET</b>
*
* @method getFirewallByUser_and_ID_V2
* 
* @param {Integer} iduser User identifier
* @param {Integer} id Firewall identifier
* 
* @return {JSON} Returns Json Data from Firewall
*/
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
//                    title : "Servicio rest con nodejs, express 4 and mysql", 
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
/**
* Get Firewalls by Name and User
* 
* <br>ROUTE CALL:  <b>/firewalls/:iduser/name/:name</b>
* <br>METHOD: <b>GET</b>
*
* @method getFirewallByUser_and_Name_V2
* 
* @param {Integer} iduser User identifier
* @param {String} name Firewall Name
* 
* @return {JSON} Returns Json Data from Firewall
*/
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



/**
* DELETE firewall
* 
* 
* > ROUTE CALL:  __/firewalls/firewall__      
* > METHOD:  __DELETE__
* 
*
* @method DeleteFirewall
* 
* @param {Integer} id Firewall identifier
* @optional
* 
* @return {JSON} Returns Json result
* @example 
* #### JSON RESPONSE OK:
*    
*       {"data" : [
*          { 
*           "msg : "success",   //result
*          }
*         ]
*       };
*       
* #### JSON RESPONSE ERROR:
*    
*       {"data" : [
*          { 
*           "msg : ERROR,   //Text Error
*          }
*         ]
*       };
*/
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