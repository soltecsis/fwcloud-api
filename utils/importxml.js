var express = require('express');
var router = express.Router();
var util = require('util');
var asyncMod = require('async');
var IpobjModel = require('../models/ipobj/ipobj');
var InterfaceModel = require('../models/interface/interface');
var Interface__ipobjModel = require('../models/interface/interface__ipobj');
var Ipobj_gModel = require('../models/ipobj/ipobj_g');
var Ipobj__ipobjgModel = require('../models/ipobj/ipobj__ipobjg');
var FirewallModel = require('../models/firewall/firewall');
var InterfaceModel = require('../models/interface/interface');
var Policy_rModel = require('../models/policy/policy_r');
var Policy_r__ipobjModel = require('../models/policy/policy_r__ipobj');
var Policy_r__interfaceModel = require('../models/policy/policy_r__interface');

var FwcloudModel = require('../models/fwcloud/fwcloud');

var fs = require('fs');
var xml2js = require('xml2js');


var logger = require('log4js').getLogger("app");

router.get('/foo', function (req, res)
{
    var parser = new xml2js.Parser();
    fs.readFile(__dirname + '/xml/foo.xml', function (error, data) {
        if (error) {
            logger.debug(error);
        } else {
            parser.parseString(data, function (err, result) {
                console.dir(result);
                logger.debug('Done');
            });
        }
    });

});

router.get('/importfirewalls/:iduser/fwcloud/:fwcloud/library/:library', function (req, res)
{
    var parser = new xml2js.Parser();
    var fwcloud = req.params.fwcloud;
    var fwc_file = "";

    var library = req.params.library.toUpperCase();


    var iduser = req.params.iduser;
    var searchlibrary = "";
    logger.debug("READING LIBRARY: " + library);

    if (library === "STANDARD") {
        fwcloud = null;
        fwc_file = "/xml/FW-TEST_STANDAR.fwb";

        searchlibrary = "Standard";
    } else if (library === "USER") {
        fwc_file = "/xml/FW-TEST_USER.fwb";
        searchlibrary = "User";
    }

    fs.readFile(__dirname + fwc_file, function (error, data) {
        if (error) {
            logger.debug(error);
            res.status(500).json({"error": error});
        } else {
            parser.parseString(data, function (err, result) {

                try {
                    var jsonstr = JSON.stringify(result);
                    var obj = JSON.parse(jsonstr);
                } catch (e) {
                    logger.debug(e);
                }

                try {
                    var row;
                    //Buscamos libreria 
                    var library;
                    SearchNode(obj.FWObjectDatabase.Library, searchlibrary, function (row) {
                        logger.debug("-------> DEVUELTO Library : " + row.$.name);
                        library = row;
                    });

                } catch (e) {
                    logger.debug("ERROR : " + e);
                }

                //ObjectGroup - Firewall
                try {
                    var rows;
                    SearchNode(library.ObjectGroup, "Firewalls", function (row) {
                        logger.debug("-------> DEVUELTO GRUPO : " + row.$.name);
                        rows = row;
                    });
                    //var rows = obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[0].IPv4;
                    var i = 0;
                    asyncMod.forEach(rows.Firewall,
                            function (row, callback) {
                                i++;
                                logger.debug("Añadiendo FIREWALL :" + i + " - " + row.$.name + " en FWCLOUD: " + fwcloud);
                                AddFirewall(iduser, row.$, fwcloud, function (error, data) {
                                    if (error)
                                        logger.debug("ERROR Añadiendo Firewall : " + error);
                                    else {
                                        logger.debug("Añadido Firewall con ID: " + data.insertId + " en FWCLOUD: " + fwcloud);
                                        var idfirewall = data.insertId;

                                        //añadimos Interfaces
                                        //ObjectGroup - Interface
                                        try {
                                            var i = 0;
                                            asyncMod.forEach(row.Interface,
                                                    function (rowI, callback) {
                                                        i++;
                                                        logger.debug("Añadiendo OBJETO Interface:" + i + " - " + rowI.$.name);
                                                        AddInterfaceFw(idfirewall, rowI.$, function (error, data) {
                                                            if (error)
                                                                logger.debug("ERROR Añadiendo Interface : " + error);
                                                            else {
                                                                logger.debug("Añadido Interface con ID: " + data.insertId);
                                                                var idinterface = data.insertId;
                                                                //Añadimos OBJECTS IP de Interface
                                                                asyncMod.forEach(rowI.IPv4,
                                                                        function (rowIP, callback) {
                                                                            logger.debug("Añadiendo OBJETO Address:" + rowIP.$.name);
                                                                            AddIpobjectAddress(rowIP.$, 5, 'IPv4', idinterface, fwcloud);
                                                                        }
                                                                );
                                                            }

                                                        });
                                                    }
                                            );
                                        } catch (e) {
                                            logger.debug("ERROR Objects Interface: " + e);
                                        }

                                        //añadimos NAT
                                        //ObjectGroup - NAT - NATRule
                                        try {
                                            var n = 0;
                                            var NATGroup = row.NAT[0];
                                            asyncMod.forEach(NATGroup.NATRule,
                                                    function (rowNR, callback1) {
                                                        n++;
                                                        logger.debug("Añadiendo NAT RULE:" + n + " - " + rowNR.$.id);
                                                        AddPolicyRule(idfirewall, rowNR.$, "4", function (error, data) {
                                                            if (data && data.length > 0)
                                                            {
                                                                logger.debug("Añadido NATRule con ID: " + data.insertId);
                                                                var idPolicy = data.insertId;
                                                                //Añadimos Objetos de Regla NAT
                                                                AddPolicyObj(idPolicy, rowNR.OSrc, 11, "O");
                                                                AddPolicyObj(idPolicy, rowNR.ODst, 12, "O");
                                                                AddPolicyObj(idPolicy, rowNR.OSrv, 13, "S");
                                                                AddPolicyObj(idPolicy, rowNR.TSrc, 14, "O");
                                                                AddPolicyObj(idPolicy, rowNR.TDst, 15, "O");
                                                                AddPolicyObj(idPolicy, rowNR.TSrv, 16, "S");
                                                                AddPolicyInterface(idfirewall, idPolicy, rowNR.ItfInb, 23);
                                                                AddPolicyInterface(idfirewall, idPolicy, rowNR.ItfOutb, 24);

                                                                AddPolicyObj(idPolicy, rowNR.ItfInb, 23, "O");
                                                                AddPolicyObj(idPolicy, rowNR.ItfOutb, 24, "O");
                                                            } else
                                                                logger.debug("ERROR Añadiendo NATRule : " + error);

                                                        });
                                                    }
                                            );
                                        } catch (e) {
                                            logger.debug("ERROR NAT RULES: " + e);
                                        }

                                        //añadimos POLICY
                                        //ObjectGroup - Policy - PolicyRule
                                        try {
                                            var n = 0;
                                            var PolicyGroup = row.Policy[0];
                                            asyncMod.forEach(PolicyGroup.PolicyRule,
                                                    function (rowPR, callback2) {
                                                        n++;
                                                        var rule_type = '';
                                                        var position = [];
                                                        var position_ref = [];

                                                        logger.debug("Añadiendo POLICY RULE:" + n + " - " + rowPR.$.id + " - DIRECTION: " + rowPR.$.direction);
                                                        switch (rowPR.$.direction) {
                                                            case "Outbound":
                                                                rule_type = '2';
                                                                position = [4, 5, 6, 21];
                                                                break;
                                                            case "Inbound":
                                                                rule_type = '1';
                                                                position = [1, 2, 3, 20];
                                                                break;
                                                            case "Both":
                                                                rule_type = '3';
                                                                position = [7, 8, 9, 22];
                                                                break;
                                                        }
                                                        AddPolicyRule(idfirewall, rowPR.$, rule_type, function (error, data) {
                                                            if (data && data.length > 0)
                                                            {
                                                                logger.debug("Añadido POLICY RULE con ID: " + data.insertId + "   REF: " + rowPR.$.id);
                                                                var idPolicy = data.insertId;
                                                                //Añadimos Objetos de Regla 
                                                                AddPolicyObj(idPolicy, rowPR.Src, position[0], "O");
                                                                AddPolicyObj(idPolicy, rowPR.Dst, position[1], "O");
                                                                AddPolicyObj(idPolicy, rowPR.Srv, position[2], "S");
                                                                AddPolicyInterface(idfirewall, idPolicy, rowPR.Itf, position[3]);
                                                            } else {
                                                                logger.debug("ERROR Añadiendo POLICY RULE : " + error);
                                                            }

                                                        });
                                                    }
                                            );
                                        } catch (e) {
                                            logger.debug("ERROR NAT RULES: " + e);
                                        }



                                    }
                                });
                            }
                    );
                } catch (e) {
                    logger.debug("ERROR Objects FIREWALL: " + e);
                }

                res.status(200).json({"data": result});
            });
        }
    });


});


/* New firewall */
function AddFirewall(iduser, row, fwcloud, callback)
{
    var firewallData = {
        id: null,
        cluster: null,
        fwcloud: fwcloud,
        name: row.name,
        comment: row.comment,
        id_fwb: row.id
    };

    FirewallModel.insertFirewall(iduser, firewallData, function (error, data)
    {
        if (data && data.insertId)
        {
            logger.debug("INSERT OK InsertId: " + data.insertId);
            callback(null, {"insertId": data.insertId});
        } else
        {
            callback(error, null);
        }
    });
}

/* Create New interface */
function AddInterfaceFw(idfirewall, row, callback)
{
    //Create New objet with data interface
    var interfaceData = {
        id: null,
        firewall: idfirewall,
        name: row.name,
        labelName: row.label,
        type: '',        
        comment: row.comment,
        interface_type: 10,
        id_fwb: row.id
    };
    //Set type 
    if (row.unnum === "True")
        interfaceData.type = "Unnumbered";
    else if (row.unprotected === "True")
        interfaceData.type = "Unprotected";

    InterfaceModel.insertInterface(interfaceData, function (error, data)
    {
        //If saved interface Get data
        if (data && data.insertId)
        {
            logger.debug("INSERT Interface OK InsertId: " + data.insertId);
            callback(null, {"insertId": data.insertId});
        } else
        {
            callback(error, null);
        }
    });
}

/* Create New policy_r */
function AddPolicyRule(idfirewall, row, type, callback)
{
    switch (row.action) {
        case "Continue":
            action = 5;
            break;
        case "Accept":
            action = 1;
            break;
        case "Deny":
            action = 2;
            break;
        case "Reject":
            action = 3;
            break;
        case "Translate":
            action = 4;
            break;
        default:
            action = 1;
            break;
    }

    //Create New objet with data policy_r
    var policy_rData = {
        id: null,
        idgroup: null,
        firewall: idfirewall,
        rule_order: row.position,
        direction: null,
        action: action,
        time_start: null,
        time_end: null,
        active: 1,
        options: null,
        comment: row.comment,
        type: type,
        fw_ref: row.id
    };
    if (row.disabled === "True")
        policy_rData.active = 0;


    Policy_rModel.insertPolicy_r(policy_rData, function (error, data)
    {
        //If saved policy_r Get data
        if (data && data.insertId)
        {
            logger.debug("INSERT PolicyRule OK InsertId: " + data.insertId + "  TYPE: " + type);
            callback(null, {"insertId": data.insertId});
        } else
        {
            callback(error, null);
        }
    });
}


/* Create New policy_r__ipobj */
function AddPolicyObj(idPolicy, row, position, typeObj)
{
    var n = 0;
    var obj = row[0];
    var negate = ((obj.$.neg === 'True') ? 1 : 0);
    var objRef;
    if (typeObj === "O")
        objRef = obj.ObjectRef;
    else
        objRef = obj.ServiceRef;


    asyncMod.forEach(objRef,
            function (rowRef, callback) {
                n++;
                var ref = rowRef.$.ref;
                logger.debug("BUSCANDO OBJREF: " + ref);

                IpobjModel.getIpobj_fwb(ref, function (error, data) {
                    if (data[0] && data[0].id) {
                        var idobj = data[0].id;
                        logger.debug("ENCONTRADO IPOBJ: " + idobj);
                        //Create New objet with data policy_r__ipobj
                        var policy_r__ipobjData = {
                            rule: idPolicy,
                            ipobj: idobj,
                            ipobj_g: 0,
                            interface: 0,
                            position: position,
                            position_order: n
                        };

                        Policy_r__ipobjModel.insertPolicy_r__ipobj(policy_r__ipobjData, negate, function (error, data)
                        {
                            //If saved policy_r__ipobj Get data
                            if (data && data.result)
                            {
                                logger.debug("INSERT PolicyRule_IPObj OK : " + idPolicy + " - " + idobj);
                                callback(null, {"msg": data.msg});
                            } else
                            {
                                logger.debug("-----> ERROR INSERT PolicyRule_IPObj : " + idPolicy + " - " + idobj + "  ERROR: " + error);
                                callback(error, null);
                            }
                        });
                    } else {
                        logger.debug("NO ECONTRADO REF : " + ref);
                    }
                });
            });

}

/* Create New policy_r__interface */
function AddPolicyInterface(idfirewall, idPolicy, row, position)
{
    var n = 0;
    var obj = row[0];
    var negate = ((obj.$.neg === 'True') ? 1 : 0);

    var objRef = obj.ObjectRef;


    asyncMod.forEach(objRef,
            function (rowRef, callback) {
                n++;
                var ref = rowRef.$.ref;
                logger.debug("BUSCANDO INTERFACE REF: " + ref);

                InterfaceModel.getInterface_fwb(idfirewall, ref, function (error, data) {
                    if (data[0] && data[0].id) {
                        var idItf = data[0].id;
                        logger.debug("ENCONTRADO INTERFACE: " + ref);
                        var policy_r__interfaceData = {
                            rule: idPolicy,
                            interface: idItf,
                            interface_order: 1,
                            negate: negate,
                            position: position,
                            position_order: 1
                        };




                        Policy_r__interfaceModel.insertPolicy_r__interface(policy_r__interfaceData, function (error, data)
                        {
                            //If saved policy_r__interface Get data
                            if (data && data.result)
                            {
                                logger.debug("INSERT PolicyRule_INTERFACE OK : " + idPolicy + " - " + ref);
                                callback(null, {"msg": data.msg});
                            } else
                            {
                                logger.debug("-----> ERROR INSERT PolicyRule_INTERFACE : " + idPolicy + " - " + ref + "  ERROR: " + error);
                                callback(error, null);
                            }
                        });

                    } else {
                        logger.debug("NO ECONTRADO INTERFACE REF : " + ref);
                    }
                });
            });

}

//////////////////////////////////////////////////////////////////////////////////////////////
// IMPORT LIBRARY STANDARD 
router.get('/importobj/:library/:fwcloud', function (req, res)
{

    var fwcloud =req.params.fwcloud;
    var fwc_file = "";

    var library = req.params.library.toUpperCase();
    var searchlibrary = "";


    if (library === "STANDARD") {
        fwcloud = null;
        fwc_file = "FWCLOUD_LIBRARY_STANDARD.json";
        searchlibrary = "Standard";
    } else if (library === "USER") {        
        fwc_file = "FWCLOUD_LIBRARY_CLOUD.json";
        searchlibrary = "User";
    }

    FwcloudModel.EmptyFwcloudStandard()
            .then(() => {

                logger.debug("READING LIBRARY: " + library, "  FILE: ", fwc_file);

                var obj = require("../config/data_ini/" + fwc_file);



                logger.debug("-----------------  DATOS OBJ JSON ---------------------------------");
                logger.debug(obj);
                logger.debug("--------------------------------------------------");
                logger.debug(util.inspect(obj.FWCLOUDObjectDatabase.Library[0].AnyNetwork[0].data.id, false, null));

                try {
                    var row;
                    //Buscamos libreria
                    var library;
                    SearchNode(obj.FWCLOUDObjectDatabase.Library, searchlibrary, function (row) {
                        logger.debug("-------> DEVUELTO Library : " + row.data.name);
                        library = row;
                    }
                    );

                    //añadimos objetos ANY                    
                    logger.debug("Añadiendo OBJETO ANYNETWORK: " + library.AnyNetwork[0].data.name);
                    AddIpobjectAddress(library.AnyNetwork[0].data, 5, '', null, fwcloud);

                    logger.debug("Añadiendo OBJETO ANYSERVICE: " + library.AnyIPService[0].data.name);
                    AddServiceIP(library.AnyIPService[0].data, 1, fwcloud);

                    logger.debug("Añadiendo OBJETO ANYINTERVAL: " + library.AnyInterval[0].data.name);
                    //KK AddServiceIP(library.AnyIPService.data, 1, fwcloud);

                    var objectsGroup;
                    //Buscamos Grupo Objects
                    SearchNode(library.ObjectGroup, "Objects", function (row) {
                        logger.debug("-------> DEVUELTO GRUPO : " + row.data.name);
                        objectsGroup = row;
                    }
                    );

                } catch (e) {
                    logger.debug("ERROR : " + e);
                }

                //ObjectGroup - Addresses
                try {
                    var rows;
                    SearchNode(objectsGroup.ObjectGroup, "Addresses", function (row) {
                        logger.debug("-------> DEVUELTO GRUPO : " + row.data.name);
                        rows = row;
                    });
                    //var rows = obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[0].IPv4;
                    var i = 0;
                    asyncMod.forEach(rows.IPv4,
                            function (row, callback) {
                                i++;
                                logger.debug("Añadiendo OBJETO Address:" + i + " - " + row.data.name);
                                AddIpobjectAddress(row.data, 5, '', null, fwcloud);
                            }
                    );
                } catch (e) {
                    logger.debug("ERROR Objects Address: " + e);
                }

                //ObjectGroup - Addresses Ranges 
                try {
                    //var rows = obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[6].AddressRange;
                    var rows;
                    SearchNode(objectsGroup.ObjectGroup, "Address Ranges", function (row) {
                        logger.debug("-------> DEVUELTO GRUPO : " + row.data.name);
                        rows = row;
                    });
                    var i = 0;
                    asyncMod.forEach(rows.AddressRange,
                            function (row, callback) {
                                i++;
                                logger.debug("Añadiendo OBJETO Address Range:" + i + " - " + row.data.name);
                                AddIpobjectAddressRanges(row.data, 6, null, fwcloud);
                            }
                    );
                } catch (e) {
                    logger.debug("ERROR Objects Address Ranges: " + e);
                }

                //ObjectGroup - Networks 
                try {

                    //var rows = obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[5].Network;
                    var rows;
                    SearchNode(objectsGroup.ObjectGroup, "Networks", function (row) {
                        logger.debug("-------> DEVUELTO GRUPO : " + row.data.name);
                        rows = row;
                    });
                    var i = 0;
                    asyncMod.forEach(rows.Network,
                            function (row, callback) {
                                i++;
                                logger.debug("Añadiendo OBJETO Network:" + i + " - " + row.data.name);
                                AddIpobjectAddress(row.data, 7, 'IPv4', null, fwcloud);
                            }
                    );

                    //var rows = obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[5].NetworkIPv6;
                    var i = 0;
                    asyncMod.forEach(rows.NetworkIPv6,
                            function (row, callback) {
                                i++;
                                logger.debug("Añadiendo OBJETO NetworkIPV6:" + i + " - " + row.data.name);
                                AddIpobjectAddress(row.data, 7, 'IPv6', null, fwcloud);
                            }
                    );
                } catch (e) {
                    logger.debug("ERROR Objects Network: " + e);
                }

                //ObjectGroup - Hosts
                try {
                    //logger.debug(util.inspect(obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[4].Host, false, null));
                    //var rows = obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[4].Host;
                    var rows;
                    SearchNode(objectsGroup.ObjectGroup, "Hosts", function (row) {
                        logger.debug("-------> DEVUELTO GRUPO : " + row.data.name);
                        rows = row;
                    });
                    var i = 0;
                    asyncMod.forEach(rows.Host,
                            function (row, callback) {
                                i++;
                                logger.debug("Añadiendo OBJETO HOST:" + i + " - " + row.data.name);
                                AddIpobject(row.data, 8, fwcloud, function (error, data) {
                                    if (error)
                                        logger.debug("ERROR Añadiendo host");
                                    else {
                                        logger.debug("Añadido host con ID: " + data.insertId);
                                        var idhost = data.insertId;
                                        //Add Interface
                                        //FALTA BUCLE por INTERFACES
                                        var rowI = row.Interface[0];
                                        logger.debug(rowI);
                                        AddInterfaceHost(rowI.data, 11, idhost, function (error, data) {
                                            if (error)
                                                logger.debug("ERROR Añadiendo Interface de  host: " + error);
                                            else {
                                                logger.debug("Añadido Interface con ID: " + data.insertId);
                                                var id_interface = data.insertId;
                                                //Add Host<->Interface relationship
                                                AddInterfaceHost_Relation(id_interface, idhost, 1, function (error, data) {
                                                    if (error)
                                                        logger.debug("ERROR Añadiendo Interface<->host: " + error);
                                                    else
                                                        logger.debug("Añadido Interface<->host: " + data.msg);
                                                });
                                                //Add IP Address 
                                                var rowIP = rowI.IPv4[0];
                                                AddIpobjectAddress(rowIP.data, 5, 'IPv4', id_interface, fwcloud);
                                            }

                                        });


                                        //Interface Options
                                    }
                                });

                            }
                    );
                } catch (e) {
                    logger.debug("ERROR Objects Host: " + e);
                }

                //ObjectGroup - GROUPS
                try {
                    //logger.debug(util.inspect(obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[3].ObjectGroup, false, null));
                    //var rows = obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[3].ObjectGroup;
                    var rows;
                    SearchNode(objectsGroup.ObjectGroup, "Groups", function (row) {
                        logger.debug("-------> DEVUELTO GRUPO : " + row.data.name);
                        rows = row;
                    });
                    var i = 0;
                    asyncMod.forEach(rows.ObjectGroup,
                            function (row, callback) {
                                i++;
                                logger.debug("Añadiendo OBJETO GROUP:" + i + " - " + row.data.name);
                                AddGroup(row.data, 20, fwcloud, function (error, data) {
                                    if (error) {
                                        logger.debug("ERROR Añadiendo GROUP: " + error);
                                    } else {
                                        logger.debug("Añadido GROUP con ID: " + data.insertId);
                                        var idgroup = data.insertId;
                                        var rowsR = row.ObjectRef;
                                        asyncMod.forEach(rowsR,
                                                function (rowR, callback) {
                                                    logger.debug("Añadiendo OBJETO de Grupo :" + idgroup + "   objref: " + rowR.data.ref);
                                                    AddGroupObj(idgroup, rowR.data.ref);
                                                });

                                    }
                                });

                            }
                    );
                } catch (e) {
                    logger.debug("ERROR Objects Address: " + e);
                }



                //READ SERVICE OBJECTS
                var ServicesGroup;
                //Buscamos Grupo Services
                SearchNode(library.ServiceGroup, "Services", function (row) {
                    logger.debug("-------> DEVUELTO GRUPO : " + row.data.name);
                    ServicesGroup = row;
                }
                );

                //ServiceGroup - IP
                try {
                    var rows;
                    SearchNode(ServicesGroup.ServiceGroup, "IP", function (row) {
                        logger.debug("-------> DEVUELTO GRUPO : " + row.data.name);
                        rows = row;
                    });
                    //var rows = obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[0].IPv4;
                    var i = 0;
                    asyncMod.forEach(rows.IPService,
                            function (row, callback) {
                                i++;
                                logger.debug("Añadiendo SERVICE IP:" + i + " - " + row.data.name);
                                AddServiceIP(row.data, 1, fwcloud);
                            }
                    );
                } catch (e) {
                    logger.debug("ERROR Service IP: " + e);
                }

                //ServiceGroup - TCP
                try {
                    var rows;
                    SearchNode(ServicesGroup.ServiceGroup, "TCP", function (row) {
                        logger.debug("-------> DEVUELTO GRUPO : " + row.data.name);
                        rows = row;
                    });
                    //var rows = obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[0].IPv4;
                    var i = 0;
                    asyncMod.forEach(rows.TCPService,
                            function (row, callback) {
                                i++;
                                logger.debug("Añadiendo SERVICE TCP:" + i + " - " + row.data.name);
                                AddServiceTCP(row.data, 2, fwcloud);
                            }
                    );
                } catch (e) {
                    logger.debug("ERROR Service TCP: " + e);
                }

                //ServiceGroup - UDP
                try {
                    var rows;
                    SearchNode(ServicesGroup.ServiceGroup, "UDP", function (row) {
                        logger.debug("-------> DEVUELTO GRUPO : " + row.data.name);
                        rows = row;
                    });
                    //var rows = obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[0].IPv4;
                    var i = 0;
                    asyncMod.forEach(rows.UDPService,
                            function (row, callback) {
                                i++;
                                logger.debug("Añadiendo SERVICE UDP:" + i + " - " + row.data.name);
                                AddServiceUDP(row.data, 4, fwcloud);
                            }
                    );
                } catch (e) {
                    logger.debug("ERROR Service UDP: " + e);
                }

                //ServiceGroup - ICMP
                try {
                    var rows;
                    SearchNode(ServicesGroup.ServiceGroup, "ICMP", function (row) {
                        logger.debug("-------> DEVUELTO GRUPO : " + row.data.name);
                        rows = row;
                    });
                    //var rows = obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[0].IPv4;
                    var i = 0;
                    asyncMod.forEach(rows.ICMPService,
                            function (row, callback) {
                                i++;
                                logger.debug("Añadiendo SERVICE ICMP:" + i + " - " + row.data.name);
                                AddServiceICMP(row.data, 3, fwcloud);
                            }
                    );
                } catch (e) {
                    logger.debug("ERROR Service ICMP: " + e);
                }
                res.status(200).json({"data": obj});
            })
                    .catch(e =>{
                        res.status(200).json({"error": e});
            });

    

});


function SearchNodeSync(rows, searchname, callback) {
    logger.debug("DENTRO de SEARCHNODE");
    //Buscamos Grupo
    asyncMod.forEach(rows,
            function (row, foundcall) {
                logger.debug("ESTAMOS en GRUPO: " + row.data.name);
                if (row.data.name === searchname) {
                    logger.debug("ENCONTRADO GRUPO: " + row.data.name);
                    return foundcall(row);
                }
                foundcall();
            },
            function (rowfound) {
                return callback(rowfound);
            }
    );

}
function SearchNode(rows, searchname, callback) {

    //Buscamos Grupo
    var n = rows.length;
    for (i = 0; i < n; i++) {
        var name = rows[i].data.name.toUpperCase();
        var sname = searchname.toUpperCase();
        logger.debug("ESTAMOS en GRUPO: " + name + " -> comparando con : " + sname);
        if (name === sname) {
            logger.debug("ENCONTRADO GRUPO: " + rows[i].data.name);
            return callback(rows[i]);
        }
    }
}




function AddIpobject(row, obj_type, fwcloud, callback) {
    //Create New objet with data ipobj    
    var ipobjData = {
        id: null,
        fwcloud: fwcloud,
        interface: null,
        name: row.name,
        type: obj_type,
        protocol: null,
        address: null,
        netmask: null,
        diff_serv: null,
        ip_version: null,
        icmp_code: null,
        icmp_type: null,
        tcp_flags_mask: null,
        tcp_flags_settings: null,
        range_start: null,
        range_end: null,
        source_port_start: 0,
        source_port_end: 0,
        destination_port_start: 0,
        destination_port_end: 0,
        options: null,
        comment: row.comment,
        id_fwb: row.id
    };

    IpobjModel.insertIpobj(ipobjData, function (error, data)
    {
        //If saved ipobj Get data
        if (data && data.insertId)
        {
            logger.debug("INSERT OK InsertId: " + data.insertId);
            callback(null, {"insertId": data.insertId});

        } else
        {
            logger.debug("ERROR INSERT insertIpobj: " + error);
            callback(error, null);
        }
    });

}

/* Create New interface */
function AddInterfaceHost(row, type, idhost, callback)
{
    //Create New objet with data interface
    var interfaceData = {
        id: null,
        firewall: null,
        name: row.name,
        labelName: row.name,
        type: type,        
        interface_type: type,
        id_fwb: row.id
    };

    InterfaceModel.insertInterface(interfaceData, function (error, data)
    {
        //If saved interface Get data
        if (data && data.insertId)
        {
            callback(null, {"insertId": data.insertId});
        } else
        {
            callback(error, null);
        }
    });
}

/* Create New interface__ipobj */
function AddInterfaceHost_Relation(id_interface, id_ipobj, order, callback)
{
    //Create New objet with data interface__ipobj
    var interface__ipobjData = {
        interface: id_interface,
        ipobj: id_ipobj,
        interface_order: order
    };

    Interface__ipobjModel.insertInterface__ipobj(interface__ipobjData, function (error, data)
    {
        //If saved interface__ipobj Get data
        if (data && data.result)
        {
            callback(null, {"msg": data.msg});
        } else
        {
            callback(error, null);
        }
    });
}

function AddIpobjectAddress(row, obj_type, ipversion, id_interface, fwcloud) {
    //Create New objet with data ipobj    
    var ipobjData = {
        id: null,
        fwcloud: fwcloud,
        interface: id_interface,
        name: row.name,
        type: obj_type,
        protocol: null,
        address: row.address,
        netmask: row.netmask,
        diff_serv: null,
        ip_version: ipversion,
        icmp_code: null,
        icmp_type: null,
        tcp_flags_mask: null,
        tcp_flags_settings: null,
        range_start: null,
        range_end: null,
        source_port_start: 0,
        source_port_end: 0,
        destination_port_start: 0,
        destination_port_end: 0,
        options: null,
        comment: row.comment,
        id_fwb: row.id
    };

    IpobjModel.insertIpobj(ipobjData, function (error, data)
    {
        //If saved ipobj Get data
        if (data && data.insertId)
        {
            logger.debug("INSERT IpobjectAddress OK InsertId: " + data.insertId);

        } else
        {
            logger.debug("ERROR IpobjectAddress INSERT insertIpobj: " + error);
        }
    });

}

function AddIpobjectAddressRanges(row, obj_type, fwcloud) {
    //Create New objet with data ipobj    
    var ipobjData = {
        id: null,
        fwcloud: fwcloud,
        interface: null,
        name: row.name,
        type: obj_type,
        protocol: null,
        address: null,
        netmask: null,
        diff_serv: null,
        ip_version: null,
        icmp_code: null,
        icmp_type: null,
        tcp_flags_mask: null,
        tcp_flags_settings: null,
        range_start: row.start_address,
        range_end: row.end_address,
        source_port_start: 0,
        source_port_end: 0,
        destination_port_start: 0,
        destination_port_end: 0,
        options: null,
        comment: row.comment,
        id_fwb: row.id
    };

    IpobjModel.insertIpobj(ipobjData, function (error, data)
    {
        //If saved ipobj Get data
        if (data && data.insertId)
        {
            logger.debug("INSERT OK InsertId: " + data.insertId);

        } else
        {
            logger.debug("ERROR INSERT insertIpobj: " + error);
        }
    });

}

/* Create New ipobj_g */
function AddGroup(row, type, fwcloud, callback)
{
    //Create New objet with data ipobj_g
    var ipobj_gData = {
        id: null,
        name: row.name,
        type: type,
        fwcloud: fwcloud,
        id_fwb: row.id
    };

    Ipobj_gModel.insertIpobj_g(ipobj_gData, function (error, data)
    {
        //If saved ipobj_g Get data
        if (data && data.insertId)
        {
            callback(null, {"insertId": data.insertId});
        } else
        {
            callback(error, null);
        }
    });
}

/* Create New ipobj_g */
function AddGroupObj(idgroup, objref)
{
    Ipobj__ipobjgModel.insertIpobj__ipobjg_objref(idgroup, objref, function (error, result)
    {
        //If saved ipobj_g Get data
        if (result)
        {
            logger.debug("INSERT OK : " + result.msg);
        } else
        {
            logger.debug("ERROR INSERT insertIpobj__ipobjg_objref: " + error);
        }
    });
}

function AddServiceIP(row, obj_type, fwcloud) {
    //Create New objet with data ipobj    
    var ipobjData = {
        id: null,
        fwcloud: fwcloud,
        interface: null,
        name: row.name,
        type: obj_type,
        protocol: row.protocol_num,
        address: null,
        netmask: null,
        diff_serv: 2,
        ip_version: null,
        icmp_code: null,
        icmp_type: null,
        tcp_flags_mask: null,
        tcp_flags_settings: null,
        range_start: null,
        range_end: null,
        source_port_start: 0,
        source_port_end: 0,
        destination_port_start: 0,
        destination_port_end: 0,
        options: null,
        comment: row.comment,
        id_fwb: row.id
    };

    IpobjModel.insertIpobj(ipobjData, function (error, data)
    {
        //If saved ipobj Get data
        if (data && data.insertId)
        {
            logger.debug("INSERT OK IP Service InsertId: " + data.insertId);
        } else
        {
            logger.debug("ERROR INSERT IP Service: " + error);
        }
    });

}
function AddServiceTCP(row, obj_type, fwcloud) {
    //Create New objet with data ipobj    
    var ipobjData = {
        id: null,
        fwcloud: fwcloud,
        interface: null,
        name: row.name,
        type: obj_type,
        protocol: null,
        address: null,
        netmask: null,
        diff_serv: 2,
        ip_version: null,
        icmp_code: null,
        icmp_type: null,
        tcp_flags_mask: null,
        tcp_flags_settings: null,
        range_start: null,
        range_end: null,
        source_port_start: row.src_range_start,
        source_port_end: row.src_range_end,
        destination_port_start: row.dst_range_start,
        destination_port_end: row.dst_range_end,
        options: null,
        comment: row.comment,
        id_fwb: row.id
    };

    IpobjModel.insertIpobj(ipobjData, function (error, data)
    {
        //If saved ipobj Get data
        if (data && data.insertId)
        {
            logger.debug("INSERT OK TCP Service InsertId: " + data.insertId);
        } else
        {
            logger.debug("ERROR INSERT TCP Service : " + error);
        }
    });

}

function AddServiceUDP(row, obj_type, fwcloud) {
    //Create New objet with data ipobj    
    var ipobjData = {
        id: null,
        fwcloud: fwcloud,
        interface: null,
        name: row.name,
        type: obj_type,
        protocol: null,
        address: null,
        netmask: null,
        diff_serv: null,
        ip_version: null,
        icmp_code: null,
        icmp_type: null,
        tcp_flags_mask: null,
        tcp_flags_settings: null,
        range_start: null,
        range_end: null,
        source_port_start: row.src_range_start,
        source_port_end: row.src_range_end,
        destination_port_start: row.dst_range_start,
        destination_port_end: row.dst_range_end,
        options: null,
        comment: row.comment,
        id_fwb: row.id
    };

    IpobjModel.insertIpobj(ipobjData, function (error, data)
    {
        //If saved ipobj Get data
        if (data && data.insertId)
        {
            logger.debug("INSERT OK UDP Service InsertId: " + data.insertId);
        } else
        {
            logger.debug("ERROR INSERT UDP Service : " + error);
        }
    });

}

function AddServiceICMP(row, obj_type, fwcloud) {
    //Create New objet with data ipobj    
    //FALTA TYPE ICMP
    var ipobjData = {
        id: null,
        fwcloud: fwcloud,
        interface: null,
        name: row.name,
        type: obj_type,
        protocol: null,
        address: null,
        netmask: null,
        diff_serv: null,
        ip_version: null,
        icmp_code: row.code,
        icmp_type: null,
        tcp_flags_mask: null,
        tcp_flags_settings: null,
        range_start: null,
        range_end: null,
        source_port_start: null,
        source_port_end: null,
        destination_port_start: null,
        destination_port_end: null,
        options: null,
        comment: row.comment,
        id_fwb: row.id
    };

    IpobjModel.insertIpobj(ipobjData, function (error, data)
    {
        //If saved ipobj Get data
        if (data && data.insertId)
        {
            logger.debug("INSERT OK ICMP Service InsertId: " + data.insertId);
        } else
        {
            logger.debug("ERROR INSERT ICMP Service : " + error);
        }
    });

}

module.exports = router;