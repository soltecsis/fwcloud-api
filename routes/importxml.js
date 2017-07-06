var express = require('express');
var router = express.Router();
var util = require('util');
var async = require('async');
var IpobjModel = require('../models/ipobj');
var InterfaceModel = require('../models/interface');
var Interface__ipobjModel = require('../models/interface__ipobj');
var Ipobj_gModel = require('../models/ipobj_g');
var Ipobj__ipobjgModel = require('../models/ipobj__ipobjg');


var fs = require('fs'),
        xml2js = require('xml2js');



router.get('/foo', function (req, res)
{
    var parser = new xml2js.Parser();
    fs.readFile(__dirname + '/xml/foo.xml', function (error, data) {
        if (error) {
            console.log(error);
        } else {
            parser.parseString(data, function (err, result) {
                console.dir(result);
                console.log('Done');
            });
        }
    });

});

router.get('/importall', function (req, res)
{
    var parser = new xml2js.Parser();
    fs.readFile(__dirname + '/xml/FW-TEST_STANDAR.fwb', function (error, data) {
        if (error) {
            console.log(error);
            res.json(500, {"error": error});
        } else {
            parser.parseString(data, function (err, result) {

                //console.dir(result);
                console.log(util.inspect(result, false, null));
                console.log('Done');
//                var response = '';
                try {
                    var jsonstr = JSON.stringify(result);
//                    console.log("INI JSON STR: ");
//                    console.log(jsonstr);
//                    console.log("END JSON STR: ");
                    var obj = JSON.parse(jsonstr);
                } catch (e) {
                    console.log(e);
                }

                //console.log(obj);
                //console.log("DATOS OBJ");
                //console.log(util.inspect(obj.FWObjectDatabase.Library[0].AnyNetwork[0].$.id, false, null));

                //ObjectGroup - Addresses
                try {
                    console.log(util.inspect(obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[0].IPv4, false, null));
                    var rows = obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[0].IPv4;
                    var i = 0;
                    async.forEach(rows,
                            function (row, callback) {
                                i++;
                                console.log("Añadiendo OBJETO Address:" + i + " - " + row.$.name);
                                AddIpobjectAddress(row.$, 5, '', null);
                            }
                    );
                } catch (e) {
                    console.log("ERROR Objects Address: " + e);
                }

                //ObjectGroup - Addresses Ranges 
                try {
                    console.log(util.inspect(obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[6].AddressRange, false, null));
                    var rows = obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[6].AddressRange;
                    var i = 0;
                    async.forEach(rows,
                            function (row, callback) {
                                i++;
                                console.log("Añadiendo OBJETO Address Range:" + i + " - " + row.$.name);
                                AddIpobjectAddressRanges(row.$, 6, null);
                            }
                    );
                } catch (e) {
                    console.log("ERROR Objects Address Ranges: " + e);
                }

                //ObjectGroup - Networks 
                try {
                    console.log(util.inspect(obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[5].Network, false, null));
                    var rows = obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[5].Network;
                    var i = 0;
                    async.forEach(rows,
                            function (row, callback) {
                                i++;
                                console.log("Añadiendo OBJETO Network:" + i + " - " + row.$.name);
                                AddIpobjectAddress(row.$, 7, 'IPv4', null);
                            }
                    );

                    var rows = obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[5].NetworkIPv6;
                    var i = 0;
                    async.forEach(rows,
                            function (row, callback) {
                                i++;
                                console.log("Añadiendo OBJETO NetworkIPV6:" + i + " - " + row.$.name);
                                AddIpobjectAddress(row.$, 7, 'IPv6', null);
                            }
                    );
                } catch (e) {
                    console.log("ERROR Objects Network: " + e);
                }

                //ObjectGroup - Hosts
                try {
                    //console.log(util.inspect(obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[4].Host, false, null));
                    var rows = obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[4].Host;
                    var i = 0;
                    async.forEach(rows,
                            function (row, callback) {
                                i++;
                                console.log("Añadiendo OBJETO HOST:" + i + " - " + row.$.name);
                                AddIpobject(row.$, 8, function (error, data) {
                                    if (error)
                                        console.log("ERROR Añadiendo host");
                                    else {
                                        console.log("Añadido host con ID: " + data.insertId);
                                        var idhost = data.insertId;
                                        //Add Interface
                                        //FALTA BUCLE por INTERFACES
                                        var rowI = row.Interface[0];
                                        console.log(rowI);
                                        AddInterfaceHost(rowI.$, 11, idhost, function (error, data) {
                                            if (error)
                                                console.log("ERROR Añadiendo Interface de  host: " + error);
                                            else {
                                                console.log("Añadido Interface con ID: " + data.insertId);
                                                var id_interface = data.insertId;
                                                //Add Host<->Interface relationship
                                                AddInterfaceHost_Relation(id_interface, idhost, 1, function (error, data) {
                                                    if (error)
                                                        console.log("ERROR Añadiendo Interface<->host: " + error);
                                                    else
                                                        console.log("Añadido Interface<->host: " + data.insertId);
                                                });
                                                //Add IP Address 
                                                var rowIP = rowI.IPv4[0];
                                                AddIpobjectAddress(rowIP.$, 5, 'IPv4', id_interface);
                                            }

                                        });


                                        //Interface Options
                                    }
                                });

                            }
                    );
                } catch (e) {
                    console.log("ERROR Objects Host: " + e);
                }

                //ObjectGroup - GROUPS
                try {
                    console.log(util.inspect(obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[3].ObjectGroup, false, null));
                    var rows = obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[3].ObjectGroup;
                    var i = 0;
                    async.forEach(rows,
                            function (row, callback) {
                                i++;
                                console.log("Añadiendo OBJETO GROUP:" + i + " - " + row.$.name);
                                AddGroup(row.$, 20, function (error, data) {
                                    if (error) {
                                        console.log("ERROR Añadiendo GROUP: " + error);
                                    } else {
                                        console.log("Añadido GROUP con ID: " + data.insertId);
                                        var idgroup = data.insertId;
                                        var rowsR = row.ObjectRef;
                                        async.forEach(rowsR,
                                                function (rowR, callback) {
                                                    console.log("Añadiendo OBJETO de Grupo :" + idgroup + "   objref: " + rowR.$.ref);
                                                    AddGroupObj(idgroup, rowR.$.ref);
                                                });

                                    }
                                });

                            }
                    );
                } catch (e) {
                    console.log("ERROR Objects Address: " + e);
                }

                res.json(200, {"data": result});
            });
        }
    });
});


function AddIpobject(row, obj_type, callback) {
    //Create New objet with data ipobj    
    var ipobjData = {
        id: null,
        fwcloud: null,
        interface: null,
        name: row.name,
        type: obj_type,
        protocol: null,
        address: null,
        netmask: null,
        diff_serv: null,
        ip_version: null,
        code: null,
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
            console.log("INSERT OK InsertId: " + data.insertId);
            callback(null, {"insertId": data.insertId});

        } else
        {
            console.log("ERROR INSERT insertIpobj: " + error);
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
        securityLevel: row.security_level,
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
        if (data && data.msg)
        {
            callback(null, {"insertId": data.insertId});
        } else
        {
            callback(error, null);
        }
    });
}

function AddIpobjectAddress(row, obj_type, ipversion, id_interface) {
    //Create New objet with data ipobj    
    var ipobjData = {
        id: null,
        fwcloud: null,
        interface: id_interface,
        name: row.name,
        type: obj_type,
        protocol: null,
        address: row.address,
        netmask: row.netmask,
        diff_serv: null,
        ip_version: ipversion,
        code: null,
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
            console.log("INSERT OK InsertId: " + data.insertId);

        } else
        {
            console.log("ERROR INSERT insertIpobj: " + error);
        }
    });

}

function AddIpobjectAddressRanges(row, obj_type) {
    //Create New objet with data ipobj    
    var ipobjData = {
        id: null,
        fwcloud: null,
        interface: null,
        name: row.name,
        type: obj_type,
        protocol: null,
        address: null,
        netmask: null,
        diff_serv: null,
        ip_version: null,
        code: null,
        tcp_flags_mask: null,
        tcp_flags_settings: null,
        range_start: row.start_address,
        range_end: row.end_address,
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
            console.log("INSERT OK InsertId: " + data.insertId);

        } else
        {
            console.log("ERROR INSERT insertIpobj: " + error);
        }
    });

}

/* Create New ipobj_g */
function AddGroup(row, type, callback)
{
    //Create New objet with data ipobj_g
    var ipobj_gData = {
        id: null,
        name: row.name,
        type: type,
        fwcloud: null,
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
            console.log("INSERT OK : " + result.msg);
        } else
        {
            console.log("ERROR INSERT insertIpobj__ipobjg_objref: " + error);
        }
    });
}


module.exports = router;