YUI.add("yuidoc-meta", function(Y) {
   Y.YUIDoc = { meta: {
    "classes": [
        "ClusterRouter",
        "CompileRouter",
        "FirewallModel",
        "FirewallRouter",
        "FwcloudModel",
        "FwcloudRouter",
        "IpobjModel",
        "IpobjsRouter"
    ],
    "modules": [
        "Cluster",
        "Compile",
        "Firewall",
        "FirewallExport",
        "Fwcloud",
        "Ipobjs",
        "OpenVPN"
    ],
    "allModules": [
        {
            "displayName": "Cluster",
            "name": "Cluster",
            "description": "Module to routing CLUSTER requests\n<br>BASE ROUTE CALL: <b>/clusters</b>"
        },
        {
            "displayName": "Compile",
            "name": "Compile",
            "description": "Module to routing COMPILE requests\n<br>BASE ROUTE CALL: <b>/policy/compile</b>"
        },
        {
            "displayName": "Firewall",
            "name": "Firewall",
            "description": "Module to routing Firewalls requests\n<br>BASE ROUTE CALL: <b>/firewalls</b>"
        },
        {
            "displayName": "FirewallExport",
            "name": "FirewallExport",
            "description": "Module to manage Firewalls export process"
        },
        {
            "displayName": "Fwcloud",
            "name": "Fwcloud",
            "description": "Module to routing FWCloud requests\n<br>BASE ROUTE CALL: <b>/fwclouds</b>"
        },
        {
            "displayName": "Ipobjs",
            "name": "Ipobjs",
            "description": "ROUTE Module to routing IPOBJ requests\n<br>BASE ROUTE CALL: <b>/ipobjs</b>"
        },
        {
            "displayName": "OpenVPN",
            "name": "OpenVPN",
            "description": "Module to routing OpenVPN requests\n<br>BASE ROUTE CALL: <b>/vpn/openvpn</b>"
        }
    ],
    "elements": []
} };
});