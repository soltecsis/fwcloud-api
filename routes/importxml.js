var express = require('express');
var router = express.Router();
var util = require('util');
var async = require('async');
var IpobjModel = require('../models/ipobj');
var InterfaceModel = require('../models/interface');
var Interface__ipobjModel = require('../models/interface__ipobj');
var Ipobj_gModel = require('../models/ipobj_g');
var Ipobj__ipobjgModel = require('../models/ipobj__ipobjg');
var FirewallModel = require('../models/firewall');
var InterfaceModel = require('../models/interface');

var fs = require('fs');
var xml2js = require('xml2js');



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

router.get('/importfirewalls/:iduser/fwcloud/:fwcloud/library/:library', function (req, res)
{
    var parser = new xml2js.Parser();
    var fwcloud = null;
    var fwc_file = "";

    var library = req.params.library.toUpperCase();
    var iduser = req.params.iduser;
    var searchlibrary = "";
    console.log("READING LIBRARY: " + library);

    if (library === "STANDARD") {
        fwcloud = null;
        fwc_file = "/xml/FW-TEST_STANDAR.fwb";
        searchlibrary = "Standard";
    } else if (library === "USER") {
        fwcloud = 1;
        fwc_file = "/xml/FW-TEST_USER.fwb";
        searchlibrary = "User";
    }

    fs.readFile(__dirname + fwc_file, function (error, data) {
        if (error) {
            console.log(error);
            res.json(500, {"error": error});
        } else {
            parser.parseString(data, function (err, result) {

                try {
                    var jsonstr = JSON.stringify(result);
                    var obj = JSON.parse(jsonstr);
                } catch (e) {
                    console.log(e);
                }

                try {
                    var row;
                    //Buscamos libreria 
                    var library;
                    SearchNode(obj.FWObjectDatabase.Library, searchlibrary, function (row) {
                        console.log("-------> DEVUELTO Library : " + row.$.name);
                        library = row;
                    });

                } catch (e) {
                    console.log("ERROR : " + e);
                }

                //ObjectGroup - Firewall
                try {
                    var rows;
                    SearchNode(library.ObjectGroup, "Firewalls", function (row) {
                        console.log("-------> DEVUELTO GRUPO : " + row.$.name);
                        rows = row;
                    });
                    //var rows = obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[0].IPv4;
                    var i = 0;
                    async.forEach(rows.Firewall,
                            function (row, callback) {
                                i++;
                                console.log("Añadiendo FIREWALL :" + i + " - " + row.$.name);
                                AddFirewall(iduser, row.$, fwcloud, function (error, data) {
                                    if (error)
                                        console.log("ERROR Añadiendo Firewall : " + error);
                                    else {
                                        console.log("Añadido Firewall con ID: " + data.insertId);
                                        var idfirewall = data.insertId;

                                        //añadimos Interfaces
                                        //ObjectGroup - Interface
                                        try {
                                            var i = 0;
                                            async.forEach(row.Interface,
                                                    function (rowI, callback) {
                                                        i++;
                                                        console.log("Añadiendo OBJETO Interface:" + i + " - " + rowI.$.name);                                                        
                                                        AddInterfaceFw(idfirewall, rowI.$, function (error, data) {
                                                            if (error)
                                                                console.log("ERROR Añadiendo Interface : " + error);
                                                            else {
                                                                console.log("Añadido Interface con ID: " + data.insertId);
                                                                var idinterface = data.insertId;
                                                                //Añadimos OBJECTS IP de Interface
                                                                async.forEach(rowI.IPv4,
                                                                        function (rowIP, callback) {                                                                            
                                                                            console.log("Añadiendo OBJETO Address:" + rowIP.$.name);
                                                                            AddIpobjectAddress(rowIP.$, 5, 'IPv4',idinterface, fwcloud);
                                                                        }
                                                                );
                                                            }

                                                        });
                                                    }
                                            );
                                        } catch (e) {
                                            console.log("ERROR Objects Interface: " + e);
                                        }



                                    }
                                });
                            }
                    );
                } catch (e) {
                    console.log("ERROR Objects FIREWALL: " + e);
                }

                res.json(200, {"data": result});
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
            console.log("INSERT OK InsertId: " + data.insertId);
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
        securityLevel: row.security_level,
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
            console.log("INSERT Interface OK InsertId: " + data.insertId);
            callback(null, {"insertId": data.insertId});
        } else
        {
            callback(error, null);
        }
    });
}

router.get('/importobj/:library', function (req, res)
{
    var parser = new xml2js.Parser();
    var fwcloud = null;
    var fwc_file = "";

    var library = req.params.library.toUpperCase();
    var searchlibrary = "";
    console.log("READING LIBRARY: " + library);

    if (library === "STANDARD") {
        fwcloud = null;
        fwc_file = "/xml/FW-TEST_STANDAR.fwb";
        searchlibrary = "Standard";
    } else if (library === "USER") {
        fwcloud = 1;
        fwc_file = "/xml/FW-TEST_USER.fwb";
        searchlibrary = "User";
    }

    fs.readFile(__dirname + fwc_file, function (error, data) {
        if (error) {
            console.log(error);
            res.json(500, {"error": error});
        } else {
            parser.parseString(data, function (err, result) {


                //KK  console.log(util.inspect(result, false, null));
                console.log('Done');
                try {
                    var jsonstr = JSON.stringify(result);
                    var obj = JSON.parse(jsonstr);
                } catch (e) {
                    console.log(e);
                }

                //console.log(obj);
                //console.log("DATOS OBJ");
                //console.log(util.inspect(obj.FWObjectDatabase.Library[0].AnyNetwork[0].$.id, false, null));

                try {
                    var row;
                    //Buscamos libreria
                    var library;
                    SearchNode(obj.FWObjectDatabase.Library, searchlibrary, function (row) {
                        console.log("-------> DEVUELTO Library : " + row.$.name);
                        library = row;
                    }
                    );


                    var objectsGroup;
                    //Buscamos Grupo Objects
                    SearchNode(library.ObjectGroup, "Objects", function (row) {
                        console.log("-------> DEVUELTO GRUPO : " + row.$.name);
                        objectsGroup = row;
                    }
                    );

                } catch (e) {
                    console.log("ERROR : " + e);
                }

                //ObjectGroup - Addresses
                try {
                    var rows;
                    SearchNode(objectsGroup.ObjectGroup, "Addresses", function (row) {
                        console.log("-------> DEVUELTO GRUPO : " + row.$.name);
                        rows = row;
                    });
                    //var rows = obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[0].IPv4;
                    var i = 0;
                    async.forEach(rows.IPv4,
                            function (row, callback) {
                                i++;
                                console.log("Añadiendo OBJETO Address:" + i + " - " + row.$.name);
                                AddIpobjectAddress(row.$, 5, '', null, fwcloud);
                            }
                    );
                } catch (e) {
                    console.log("ERROR Objects Address: " + e);
                }

                //ObjectGroup - Addresses Ranges 
                try {
                    //var rows = obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[6].AddressRange;
                    var rows;
                    SearchNode(objectsGroup.ObjectGroup, "Address Ranges", function (row) {
                        console.log("-------> DEVUELTO GRUPO : " + row.$.name);
                        rows = row;
                    });
                    var i = 0;
                    async.forEach(rows.AddressRange,
                            function (row, callback) {
                                i++;
                                console.log("Añadiendo OBJETO Address Range:" + i + " - " + row.$.name);
                                AddIpobjectAddressRanges(row.$, 6, null, fwcloud);
                            }
                    );
                } catch (e) {
                    console.log("ERROR Objects Address Ranges: " + e);
                }

                //ObjectGroup - Networks 
                try {

                    //var rows = obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[5].Network;
                    var rows;
                    SearchNode(objectsGroup.ObjectGroup, "Networks", function (row) {
                        console.log("-------> DEVUELTO GRUPO : " + row.$.name);
                        rows = row;
                    });
                    var i = 0;
                    async.forEach(rows.Network,
                            function (row, callback) {
                                i++;
                                console.log("Añadiendo OBJETO Network:" + i + " - " + row.$.name);
                                AddIpobjectAddress(row.$, 7, 'IPv4', null, fwcloud);
                            }
                    );

                    //var rows = obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[5].NetworkIPv6;
                    var i = 0;
                    async.forEach(rows.NetworkIPv6,
                            function (row, callback) {
                                i++;
                                console.log("Añadiendo OBJETO NetworkIPV6:" + i + " - " + row.$.name);
                                AddIpobjectAddress(row.$, 7, 'IPv6', null, fwcloud);
                            }
                    );
                } catch (e) {
                    console.log("ERROR Objects Network: " + e);
                }

                //ObjectGroup - Hosts
                try {
                    //console.log(util.inspect(obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[4].Host, false, null));
                    //var rows = obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[4].Host;
                    var rows;
                    SearchNode(objectsGroup.ObjectGroup, "Hosts", function (row) {
                        console.log("-------> DEVUELTO GRUPO : " + row.$.name);
                        rows = row;
                    });
                    var i = 0;
                    async.forEach(rows.Host,
                            function (row, callback) {
                                i++;
                                console.log("Añadiendo OBJETO HOST:" + i + " - " + row.$.name);
                                AddIpobject(row.$, 8, fwcloud, function (error, data) {
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
                                                        console.log("Añadido Interface<->host: " + data.msg);
                                                });
                                                //Add IP Address 
                                                var rowIP = rowI.IPv4[0];
                                                AddIpobjectAddress(rowIP.$, 5, 'IPv4', id_interface, fwcloud);
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
                    //console.log(util.inspect(obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[3].ObjectGroup, false, null));
                    //var rows = obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[3].ObjectGroup;
                    var rows;
                    SearchNode(objectsGroup.ObjectGroup, "Groups", function (row) {
                        console.log("-------> DEVUELTO GRUPO : " + row.$.name);
                        rows = row;
                    });
                    var i = 0;
                    async.forEach(rows.ObjectGroup,
                            function (row, callback) {
                                i++;
                                console.log("Añadiendo OBJETO GROUP:" + i + " - " + row.$.name);
                                AddGroup(row.$, 20, fwcloud, function (error, data) {
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



                //READ SERVICE OBJECTS
                var ServicesGroup;
                //Buscamos Grupo Services
                SearchNode(library.ServiceGroup, "Services", function (row) {
                    console.log("-------> DEVUELTO GRUPO : " + row.$.name);
                    ServicesGroup = row;
                }
                );

                //ServiceGroup - IP
                try {
                    var rows;
                    SearchNode(ServicesGroup.ServiceGroup, "IP", function (row) {
                        console.log("-------> DEVUELTO GRUPO : " + row.$.name);
                        rows = row;
                    });
                    //var rows = obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[0].IPv4;
                    var i = 0;
                    async.forEach(rows.IPService,
                            function (row, callback) {
                                i++;
                                console.log("Añadiendo SERVICE IP:" + i + " - " + row.$.name);
                                AddServiceIP(row.$, 1, fwcloud);
                            }
                    );
                } catch (e) {
                    console.log("ERROR Service IP: " + e);
                }

                //ServiceGroup - TCP
                try {
                    var rows;
                    SearchNode(ServicesGroup.ServiceGroup, "TCP", function (row) {
                        console.log("-------> DEVUELTO GRUPO : " + row.$.name);
                        rows = row;
                    });
                    //var rows = obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[0].IPv4;
                    var i = 0;
                    async.forEach(rows.TCPService,
                            function (row, callback) {
                                i++;
                                console.log("Añadiendo SERVICE TCP:" + i + " - " + row.$.name);
                                AddServiceTCP(row.$, 2, fwcloud);
                            }
                    );
                } catch (e) {
                    console.log("ERROR Service TCP: " + e);
                }

                //ServiceGroup - UDP
                try {
                    var rows;
                    SearchNode(ServicesGroup.ServiceGroup, "UDP", function (row) {
                        console.log("-------> DEVUELTO GRUPO : " + row.$.name);
                        rows = row;
                    });
                    //var rows = obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[0].IPv4;
                    var i = 0;
                    async.forEach(rows.UDPService,
                            function (row, callback) {
                                i++;
                                console.log("Añadiendo SERVICE UDP:" + i + " - " + row.$.name);
                                AddServiceUDP(row.$, 4, fwcloud);
                            }
                    );
                } catch (e) {
                    console.log("ERROR Service UDP: " + e);
                }

                //ServiceGroup - ICMP
                try {
                    var rows;
                    SearchNode(ServicesGroup.ServiceGroup, "ICMP", function (row) {
                        console.log("-------> DEVUELTO GRUPO : " + row.$.name);
                        rows = row;
                    });
                    //var rows = obj.FWObjectDatabase.Library[0].ObjectGroup[0].ObjectGroup[0].IPv4;
                    var i = 0;
                    async.forEach(rows.ICMPService,
                            function (row, callback) {
                                i++;
                                console.log("Añadiendo SERVICE ICMP:" + i + " - " + row.$.name);
                                AddServiceICMP(row.$, 3, fwcloud);
                            }
                    );
                } catch (e) {
                    console.log("ERROR Service ICMP: " + e);
                }



                res.json(200, {"data": result});
            });
        }
    });
});


function SearchNodeSync(rows, searchname, callback) {
    console.log("DENTRO de SEARCHNODE");
    //Buscamos Grupo
    async.forEach(rows,
            function (row, foundcall) {
                console.log("ESTAMOS en GRUPO: " + row.$.name);
                if (row.$.name === searchname) {
                    console.log("ENCONTRADO GRUPO: " + row.$.name);
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
        var name = rows[i].$.name.toUpperCase();
        var sname = searchname.toUpperCase();
        console.log("ESTAMOS en GRUPO: " + name + " -> comparando con : " + sname);
        if (name === sname) {
            console.log("ENCONTRADO GRUPO: " + rows[i].$.name);
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
            console.log("INSERT IpobjectAddress OK InsertId: " + data.insertId);

        } else
        {
            console.log("ERROR IpobjectAddress INSERT insertIpobj: " + error);
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
            console.log("INSERT OK : " + result.msg);
        } else
        {
            console.log("ERROR INSERT insertIpobj__ipobjg_objref: " + error);
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
            console.log("INSERT OK IP Service InsertId: " + data.insertId);
        } else
        {
            console.log("ERROR INSERT IP Service: " + error);
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
        code: null,
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
            console.log("INSERT OK TCP Service InsertId: " + data.insertId);
        } else
        {
            console.log("ERROR INSERT TCP Service : " + error);
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
        code: null,
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
            console.log("INSERT OK UDP Service InsertId: " + data.insertId);
        } else
        {
            console.log("ERROR INSERT UDP Service : " + error);
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
        code: row.code,
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
            console.log("INSERT OK ICMP Service InsertId: " + data.insertId);
        } else
        {
            console.log("ERROR INSERT ICMP Service : " + error);
        }
    });

}

module.exports = router;