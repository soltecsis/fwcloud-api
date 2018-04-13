YUI.add("yuidoc-meta", function(Y) {
   Y.YUIDoc = { meta: {
    "classes": [
        "ClusterRouter",
        "FirewallModel",
        "FirewallRouter",
        "IpobjModel",
        "IpobjsRouter",
        "respModel"
    ],
    "modules": [
        "Cluster",
        "Firewall",
        "Ipobjs",
        "api_response"
    ],
    "allModules": [
        {
            "displayName": "api_response",
            "name": "api_response",
            "description": "Module to manage responses\n<br>BASE ROUTE CALL: <b>/firewalls</b>"
        },
        {
            "displayName": "Cluster",
            "name": "Cluster",
            "description": "Module to routing CLUSTER requests\n<br>BASE ROUTE CALL: <b>/clusters</b>"
        },
        {
            "displayName": "Firewall",
            "name": "Firewall",
            "description": "Module to routing Firewalls requests\n<br>BASE ROUTE CALL: <b>/firewalls</b>"
        },
        {
            "displayName": "Ipobjs",
            "name": "Ipobjs",
            "description": "ROUTE Module to routing IPOBJ requests\n<br>BASE ROUTE CALL: <b>/ipobjs</b>"
        }
    ],
    "elements": []
} };
});