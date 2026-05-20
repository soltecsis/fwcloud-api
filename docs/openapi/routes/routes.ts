/* tslint:disable */
/* eslint-disable */
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import type { TsoaRoute } from '@tsoa/runtime';
import {  fetchMiddlewares, ExpressTemplateService } from '@tsoa/runtime';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { PingController } from './../../../src/controllers/ping/ping.controller';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { FwCloudController } from './../../../src/controllers/fwclouds/fwcloud.controller';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { FirewallController } from './../../../src/controllers/firewalls/firewall.controller';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { UserLegacyController } from './../../../src/controllers/legacy/user-legacy.controller';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { FwcloudLegacyController } from './../../../src/controllers/legacy/fwcloud-legacy.controller';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { FirewallLegacyController } from './../../../src/controllers/legacy/firewall-legacy.controller';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { CustomerLegacyController } from './../../../src/controllers/legacy/customer-legacy.controller';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { ClusterLegacyController } from './../../../src/controllers/legacy/cluster-legacy.controller';
import type { Request as ExRequest, Response as ExResponse, RequestHandler, Router } from 'express';



// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

const models: TsoaRoute.Models = {
    "Record_string.unknown_": {
        "dataType": "refAlias",
        "type": {"dataType":"nestedObjectLiteral","nestedProperties":{},"additionalProperties":{"dataType":"any"},"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "ResponseObject": {
        "dataType": "refAlias",
        "type": {"ref":"Record_string.unknown_","validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "ResponseData": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"ref":"ResponseObject"},{"dataType":"array","array":{"dataType":"refAlias","ref":"ResponseObject"}},{"dataType":"enum","enums":[null]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "ResponseBody": {
        "dataType": "refObject",
        "properties": {
            "status": {"dataType":"double","required":true},
            "response": {"dataType":"string","required":true},
            "data": {"ref":"ResponseData"},
            "message": {"dataType":"string","required":true},
            "errors": {"ref":"ResponseObject"},
            "stack": {"dataType":"array","array":{"dataType":"string"}},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "ResponseBuilder": {
        "dataType": "refAlias",
        "type": {"ref":"ResponseBody","validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "FwCloudLimitErrorResponse": {
        "dataType": "refObject",
        "properties": {
            "fwcErr": {"dataType":"double"},
            "msg": {"dataType":"string"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "FwCloudControllerStoreDto": {
        "dataType": "refObject",
        "properties": {
            "name": {"dataType":"string","required":true},
            "image": {"dataType":"string","required":true},
            "comment": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "FwCloudNotFoundResponse": {
        "dataType": "refObject",
        "properties": {
            "message": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "FwCloudControllerUpdateDto": {
        "dataType": "refObject",
        "properties": {
            "name": {"dataType":"string","required":true},
            "image": {"dataType":"string","required":true},
            "comment": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "FirewallApiErrorEnvelopeResponse": {
        "dataType": "refObject",
        "properties": {
            "status": {"dataType":"double","required":true},
            "response": {"dataType":"string","required":true},
            "message": {"dataType":"string","required":true},
            "errors": {"ref":"Record_string.unknown_"},
            "stack": {"dataType":"array","array":{"dataType":"string"}},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "FirewallApiEnvelopeResponse_null_": {
        "dataType": "refObject",
        "properties": {
            "status": {"dataType":"double","required":true},
            "response": {"dataType":"string","required":true},
            "message": {"dataType":"string","required":true},
            "data": {"dataType":"enum","enums":[null],"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "FirewallInstallCommunication": {
        "dataType": "refEnum",
        "enums": ["ssh","agent"],
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "FirewallInstallProtocol": {
        "dataType": "refEnum",
        "enums": ["https","http"],
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "PingDto": {
        "dataType": "refObject",
        "properties": {
            "communication": {"ref":"FirewallInstallCommunication","required":true},
            "host": {"dataType":"string","required":true},
            "port": {"dataType":"double","required":true},
            "username": {"dataType":"string"},
            "password": {"dataType":"string"},
            "protocol": {"ref":"FirewallInstallProtocol"},
            "apikey": {"dataType":"string"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "InfoDto": {
        "dataType": "refObject",
        "properties": {
            "communication": {"ref":"FirewallInstallCommunication","required":true},
            "host": {"dataType":"string","required":true},
            "port": {"dataType":"double","required":true},
            "username": {"dataType":"string"},
            "password": {"dataType":"string"},
            "protocol": {"ref":"FirewallInstallProtocol"},
            "apikey": {"dataType":"string"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "PluginsFlags": {
        "dataType": "refEnum",
        "enums": ["openvpn","geoip","crowdsec","ntopng","suricata","keepalived","zeek","elasticsearch","filebeat","websafety","kibana","logstash","dnssafety","isc-bind9","isc-dhcp","haproxy","wireguard","ipsec","irqbalance"],
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "PluginDto": {
        "dataType": "refObject",
        "properties": {
            "firewallId": {"dataType":"double"},
            "communication": {"ref":"FirewallInstallCommunication","required":true},
            "host": {"dataType":"string","required":true},
            "port": {"dataType":"double","required":true},
            "username": {"dataType":"string"},
            "password": {"dataType":"string"},
            "protocol": {"ref":"FirewallInstallProtocol"},
            "apikey": {"dataType":"string"},
            "plugin": {"ref":"PluginsFlags","required":true},
            "enable": {"dataType":"boolean","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyLoginResponse": {
        "dataType": "refObject",
        "properties": {
            "user": {"dataType":"double","required":true},
            "role": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyErrorResponse": {
        "dataType": "refObject",
        "properties": {
            "fwcErr": {"dataType":"double"},
            "msg": {"dataType":"string"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyLoginRequest": {
        "dataType": "refObject",
        "properties": {
            "customer": {"dataType":"double","required":true},
            "username": {"dataType":"string","required":true},
            "password": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyUserCreatedResponse": {
        "dataType": "refObject",
        "properties": {
            "user": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyUserUpsertRequest": {
        "dataType": "refObject",
        "properties": {
            "customer": {"dataType":"double","required":true},
            "name": {"dataType":"string","required":true},
            "email": {"dataType":"string","required":true},
            "username": {"dataType":"string","required":true},
            "password": {"dataType":"string","required":true},
            "enabled": {"dataType":"double","required":true},
            "role": {"dataType":"double","required":true},
            "allowed_from": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyChangePasswordRequest": {
        "dataType": "refObject",
        "properties": {
            "password": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyUserResponse": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"double","required":true},
            "customer": {"dataType":"double","required":true},
            "name": {"dataType":"string","required":true},
            "email": {"dataType":"string","required":true},
            "username": {"dataType":"string","required":true},
            "password": {"dataType":"string","required":true},
            "enabled": {"dataType":"double","required":true},
            "role": {"dataType":"double","required":true},
            "allowed_from": {"dataType":"string","required":true},
            "last_login": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "confirmation_token": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "created_at": {"dataType":"string","required":true},
            "updated_at": {"dataType":"string","required":true},
            "created_by": {"dataType":"double","required":true},
            "updated_by": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyUserGetRequest": {
        "dataType": "refObject",
        "properties": {
            "customer": {"dataType":"double","required":true},
            "user": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyUserDeleteRequest": {
        "dataType": "refObject",
        "properties": {
            "customer": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyRestrictionDetailsResponse": {
        "dataType": "refObject",
        "properties": {
            "response": {"dataType":"nestedObjectLiteral","nestedProperties":{"errorMsg":{"dataType":"string","required":true},"errorCode":{"dataType":"string","required":true},"respMsg":{"dataType":"string","required":true},"respCodeMsg":{"dataType":"string","required":true},"respCode":{"dataType":"string","required":true},"respStatus":{"dataType":"boolean","required":true}},"required":true},
            "data": {"ref":"Record_string.unknown_","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Record_string.boolean_": {
        "dataType": "refAlias",
        "type": {"dataType":"nestedObjectLiteral","nestedProperties":{},"additionalProperties":{"dataType":"boolean"},"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyRestrictionDeniedResponse": {
        "dataType": "refObject",
        "properties": {
            "result": {"dataType":"boolean","required":true},
            "restrictions": {"ref":"Record_string.boolean_","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyUserRestrictedRequest": {
        "dataType": "refObject",
        "properties": {
            "customer": {"dataType":"double","required":true},
            "user": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyUserFwCloudAccessRequest": {
        "dataType": "refObject",
        "properties": {
            "user": {"dataType":"double","required":true},
            "fwcloud": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyFwCloudAccessItem": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"double","required":true},
            "name": {"dataType":"string","required":true},
            "created_at": {"dataType":"string","required":true},
            "updated_at": {"dataType":"string","required":true},
            "created_by": {"dataType":"double","required":true},
            "updated_by": {"dataType":"double","required":true},
            "locked_at": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "locked_by": {"dataType":"union","subSchemas":[{"dataType":"double"},{"dataType":"enum","enums":[null]}],"required":true},
            "locked": {"dataType":"double","required":true},
            "image": {"dataType":"string","required":true},
            "comment": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyUserFwCloudAccessListRequest": {
        "dataType": "refObject",
        "properties": {
            "user": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyFwcloudResponse": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"double","required":true},
            "name": {"dataType":"string","required":true},
            "created_at": {"dataType":"string","required":true},
            "updated_at": {"dataType":"string","required":true},
            "created_by": {"dataType":"double","required":true},
            "updated_by": {"dataType":"double","required":true},
            "locked_at": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "locked_by": {"dataType":"union","subSchemas":[{"dataType":"double"},{"dataType":"enum","enums":[null]}],"required":true},
            "locked": {"dataType":"double","required":true},
            "image": {"dataType":"string","required":true},
            "comment": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyFwcloudErrorResponse": {
        "dataType": "refObject",
        "properties": {
            "fwcErr": {"dataType":"double"},
            "msg": {"dataType":"string"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyFwcloudRequest": {
        "dataType": "refObject",
        "properties": {
            "fwcloud": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyFwcloudLockInfo": {
        "dataType": "refObject",
        "properties": {
            "locked_by": {"dataType":"double","required":true},
            "ip_user": {"dataType":"string","required":true},
            "ip_name": {"dataType":"string","required":true},
            "locked_at": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyFwcloudLockResponse": {
        "dataType": "refObject",
        "properties": {
            "result": {"dataType":"boolean","required":true},
            "message": {"dataType":"string","required":true},
            "info": {"ref":"LegacyFwcloudLockInfo"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyFirewallInsertResponse": {
        "dataType": "refObject",
        "properties": {
            "insertId": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyFirewallErrorResponse": {
        "dataType": "refObject",
        "properties": {
            "fwcErr": {"dataType":"double"},
            "msg": {"dataType":"string"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyFirewallStoreRequest": {
        "dataType": "refObject",
        "properties": {
            "fwcloud": {"dataType":"double","required":true},
            "name": {"dataType":"string","required":true},
            "save_user_pass": {"dataType":"double","required":true},
            "install_port": {"dataType":"double","required":true},
            "fwmaster": {"dataType":"double","required":true},
            "options": {"dataType":"double","required":true},
            "node_id": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyFirewallUpdateRequest": {
        "dataType": "refObject",
        "properties": {
            "fwcloud": {"dataType":"double","required":true},
            "firewall": {"dataType":"double","required":true},
            "name": {"dataType":"string","required":true},
            "comment": {"dataType":"string","required":true},
            "save_user_pass": {"dataType":"double","required":true},
            "install_port": {"dataType":"double","required":true},
            "fwmaster": {"dataType":"double","required":true},
            "options": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyFirewallResponse": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"double","required":true},
            "cluster": {"dataType":"union","subSchemas":[{"dataType":"double"},{"dataType":"enum","enums":[null]}],"required":true},
            "fwcloud": {"dataType":"double","required":true},
            "name": {"dataType":"string","required":true},
            "comment": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "created_at": {"dataType":"string","required":true},
            "updated_at": {"dataType":"string","required":true},
            "compiled_at": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "installed_at": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "by_user": {"dataType":"double","required":true},
            "status": {"dataType":"double","required":true},
            "install_user": {"dataType":"string","required":true},
            "install_pass": {"dataType":"string","required":true},
            "save_user_pass": {"dataType":"double","required":true},
            "install_interface": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "install_ipobj": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "fwmaster": {"dataType":"double","required":true},
            "install_port": {"dataType":"double","required":true},
            "options": {"dataType":"double","required":true},
            "interface_name": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "ip_name": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "ip": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "id_fwmaster": {"dataType":"union","subSchemas":[{"dataType":"double"},{"dataType":"enum","enums":[null]}],"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyFirewallGetRequest": {
        "dataType": "refObject",
        "properties": {
            "fwcloud": {"dataType":"double","required":true},
            "firewall": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyFirewallCloudRequest": {
        "dataType": "refObject",
        "properties": {
            "fwcloud": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyFirewallClusterRequest": {
        "dataType": "refObject",
        "properties": {
            "fwcloud": {"dataType":"double","required":true},
            "cluster": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyFirewallCloneRequest": {
        "dataType": "refObject",
        "properties": {
            "fwcloud": {"dataType":"double","required":true},
            "firewall": {"dataType":"double","required":true},
            "name": {"dataType":"string","required":true},
            "comment": {"dataType":"string","required":true},
            "node_id": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyCustomerErrorResponse": {
        "dataType": "refObject",
        "properties": {
            "fwcErr": {"dataType":"double"},
            "msg": {"dataType":"string"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyCustomerUpsertRequest": {
        "dataType": "refObject",
        "properties": {
            "customer": {"dataType":"double","required":true},
            "name": {"dataType":"string","required":true},
            "addr": {"dataType":"string","required":true},
            "phone": {"dataType":"string","required":true},
            "email": {"dataType":"string","required":true},
            "web": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyCustomerResponse": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"double","required":true},
            "name": {"dataType":"string","required":true},
            "addr": {"dataType":"string","required":true},
            "phone": {"dataType":"string","required":true},
            "email": {"dataType":"string","required":true},
            "web": {"dataType":"string","required":true},
            "created_at": {"dataType":"string","required":true},
            "updated_at": {"dataType":"string","required":true},
            "created_by": {"dataType":"double","required":true},
            "updated_by": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyCustomerSummary": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"double","required":true},
            "name": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyCustomerGetResponse": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"ref":"LegacyCustomerResponse"},{"dataType":"array","array":{"dataType":"refObject","ref":"LegacyCustomerSummary"}}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyCustomerRequest": {
        "dataType": "refObject",
        "properties": {
            "customer": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyCustomerRestrictionResponse": {
        "dataType": "refObject",
        "properties": {
            "result": {"dataType":"boolean","required":true},
            "restrictions": {"ref":"Record_string.boolean_","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyClusterStoreResponse": {
        "dataType": "refObject",
        "properties": {
            "insertId": {"dataType":"double","required":true},
            "loData": {"ref":"Record_string.unknown_","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyClusterErrorResponse": {
        "dataType": "refObject",
        "properties": {
            "fwcErr": {"dataType":"double"},
            "msg": {"dataType":"string"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyClusterNodePayload": {
        "dataType": "refObject",
        "properties": {
            "name": {"dataType":"string","required":true},
            "comment": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "install_user": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "install_pass": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "save_user_pass": {"dataType":"double","required":true},
            "install_interface": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "install_ipobj": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "fwmaster": {"dataType":"double","required":true},
            "install_port": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyClusterStoreRequest": {
        "dataType": "refObject",
        "properties": {
            "fwcloud": {"dataType":"double","required":true},
            "node_id": {"dataType":"double","required":true},
            "clusterData": {"dataType":"nestedObjectLiteral","nestedProperties":{"fwnodes":{"dataType":"array","array":{"dataType":"refObject","ref":"LegacyClusterNodePayload"},"required":true},"options":{"dataType":"double","required":true},"name":{"dataType":"string","required":true}},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyClusterNodeResponse": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"double","required":true},
            "cluster": {"dataType":"double","required":true},
            "name": {"dataType":"string","required":true},
            "comment": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "status": {"dataType":"double","required":true},
            "install_user": {"dataType":"string","required":true},
            "install_pass": {"dataType":"string","required":true},
            "save_user_pass": {"dataType":"double","required":true},
            "install_interface": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "install_ipobj": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "fwmaster": {"dataType":"double","required":true},
            "install_port": {"dataType":"double","required":true},
            "interface_name": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "ip_name": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "ip": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "options": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyClusterResponse": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"double","required":true},
            "fwcloud": {"dataType":"double","required":true},
            "name": {"dataType":"string","required":true},
            "comment": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "created_at": {"dataType":"string","required":true},
            "updated_at": {"dataType":"string","required":true},
            "created_by": {"dataType":"double","required":true},
            "updated_by": {"dataType":"double","required":true},
            "nodes": {"dataType":"array","array":{"dataType":"refObject","ref":"LegacyClusterNodeResponse"},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyClusterGetRequest": {
        "dataType": "refObject",
        "properties": {
            "fwcloud": {"dataType":"double","required":true},
            "cluster": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyClusterSummary": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"double","required":true},
            "fwcloud": {"dataType":"double","required":true},
            "name": {"dataType":"string","required":true},
            "comment": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "created_at": {"dataType":"string","required":true},
            "updated_at": {"dataType":"string","required":true},
            "created_by": {"dataType":"double","required":true},
            "updated_by": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyClusterGetByCloudRequest": {
        "dataType": "refObject",
        "properties": {
            "fwcloud": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyClusterUpdateRequest": {
        "dataType": "refObject",
        "properties": {
            "fwcloud": {"dataType":"double","required":true},
            "clusterData": {"dataType":"nestedObjectLiteral","nestedProperties":{"options":{"dataType":"double","required":true},"name":{"dataType":"string","required":true},"cluster":{"dataType":"double","required":true}},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyClusterConvertResponse": {
        "dataType": "refObject",
        "properties": {
            "result": {"dataType":"boolean","required":true},
            "insertId": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyClusterFirewallToClusterRequest": {
        "dataType": "refObject",
        "properties": {
            "fwcloud": {"dataType":"double","required":true},
            "firewall": {"dataType":"double","required":true},
            "node_id": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyClusterClusterToFirewallRequest": {
        "dataType": "refObject",
        "properties": {
            "fwcloud": {"dataType":"double","required":true},
            "cluster": {"dataType":"double","required":true},
            "node_id": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyClusterCloneResponse": {
        "dataType": "refObject",
        "properties": {
            "insertId": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyClusterCloneRequest": {
        "dataType": "refObject",
        "properties": {
            "fwcloud": {"dataType":"double","required":true},
            "cluster": {"dataType":"double","required":true},
            "name": {"dataType":"string","required":true},
            "comment": {"dataType":"string","required":true},
            "node_id": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LegacyClusterRestrictionsResponse": {
        "dataType": "refObject",
        "properties": {
            "result": {"dataType":"boolean","required":true},
            "restrictions": {"ref":"Record_string.boolean_","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
};
const templateService = new ExpressTemplateService(models, {"noImplicitAdditionalProperties":"silently-remove-extras","bodyCoercion":true});

// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa




export function RegisterRoutes(app: Router) {

    // ###########################################################################################################
    //  NOTE: If you do not see routes for all of your controllers in this file, then you might not have informed tsoa of where to look
    //      Please look into the "controllerPathGlobs" config option described in the readme: https://github.com/lukeautry/tsoa
    // ###########################################################################################################


    
        const argsPingController_ping: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.put('/ping',
            authenticateMiddleware([{"sessionCookie":[]}]),
            ...(fetchMiddlewares<RequestHandler>(PingController)),
            ...(fetchMiddlewares<RequestHandler>(PingController.prototype.ping)),

            async function PingController_ping(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsPingController_ping, request, response });

                const controller = new PingController();

              await templateService.apiHandler({
                methodName: 'ping',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsFwCloudController_store: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
                requestBody: {"in":"body","name":"requestBody","required":true,"ref":"FwCloudControllerStoreDto"},
        };
        app.post('/fwclouds',
            authenticateMiddleware([{"sessionCookie":[],"confirmToken":[]}]),
            ...(fetchMiddlewares<RequestHandler>(FwCloudController)),
            ...(fetchMiddlewares<RequestHandler>(FwCloudController.prototype.store)),

            async function FwCloudController_store(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsFwCloudController_store, request, response });

                const controller = new FwCloudController();

              await templateService.apiHandler({
                methodName: 'store',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 201,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsFwCloudController_update: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
                requestBody: {"in":"body","name":"requestBody","required":true,"ref":"FwCloudControllerUpdateDto"},
                fwcloud: {"in":"path","name":"fwcloud","required":true,"dataType":"double"},
        };
        app.put('/fwclouds/:fwcloud',
            authenticateMiddleware([{"sessionCookie":[],"confirmToken":[]}]),
            ...(fetchMiddlewares<RequestHandler>(FwCloudController)),
            ...(fetchMiddlewares<RequestHandler>(FwCloudController.prototype.update)),

            async function FwCloudController_update(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsFwCloudController_update, request, response });

                const controller = new FwCloudController();

              await templateService.apiHandler({
                methodName: 'update',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsFwCloudController_colors: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
                fwcloud: {"in":"path","name":"fwcloud","required":true,"dataType":"double"},
        };
        app.get('/fwclouds/:fwcloud/colors',
            authenticateMiddleware([{"sessionCookie":[]}]),
            ...(fetchMiddlewares<RequestHandler>(FwCloudController)),
            ...(fetchMiddlewares<RequestHandler>(FwCloudController.prototype.colors)),

            async function FwCloudController_colors(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsFwCloudController_colors, request, response });

                const controller = new FwCloudController();

              await templateService.apiHandler({
                methodName: 'colors',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsFwCloudController_getConfig: Record<string, TsoaRoute.ParameterSchema> = {
        };
        app.get('/config',
            authenticateMiddleware([{"sessionCookie":[]}]),
            ...(fetchMiddlewares<RequestHandler>(FwCloudController)),
            ...(fetchMiddlewares<RequestHandler>(FwCloudController.prototype.getConfig)),

            async function FwCloudController_getConfig(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsFwCloudController_getConfig, request, response });

                const controller = new FwCloudController();

              await templateService.apiHandler({
                methodName: 'getConfig',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsFirewallController_compileRoutingRules: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
                fwcloud: {"in":"path","name":"fwcloud","required":true,"dataType":"double"},
                firewallId: {"in":"path","name":"firewall","required":true,"dataType":"double"},
                ruleIds: {"in":"query","name":"rules","dataType":"array","array":{"dataType":"double"}},
        };
        app.get('/fwclouds/:fwcloud/firewalls/:firewall/routingRules/compile',
            authenticateMiddleware([{"sessionCookie":[]}]),
            ...(fetchMiddlewares<RequestHandler>(FirewallController)),
            ...(fetchMiddlewares<RequestHandler>(FirewallController.prototype.compileRoutingRules)),

            async function FirewallController_compileRoutingRules(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsFirewallController_compileRoutingRules, request, response });

                const controller = new FirewallController();

              await templateService.apiHandler({
                methodName: 'compileRoutingRules',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsFirewallController_compileHAProxyRules: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
                fwcloud: {"in":"path","name":"fwcloud","required":true,"dataType":"double"},
                firewallId: {"in":"path","name":"firewall","required":true,"dataType":"double"},
                ruleIds: {"in":"query","name":"rules","dataType":"array","array":{"dataType":"double"}},
        };
        app.get('/fwclouds/:fwcloud/firewalls/:firewall/system/haproxyRules/compile',
            authenticateMiddleware([{"sessionCookie":[]}]),
            ...(fetchMiddlewares<RequestHandler>(FirewallController)),
            ...(fetchMiddlewares<RequestHandler>(FirewallController.prototype.compileHAProxyRules)),

            async function FirewallController_compileHAProxyRules(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsFirewallController_compileHAProxyRules, request, response });

                const controller = new FirewallController();

              await templateService.apiHandler({
                methodName: 'compileHAProxyRules',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsFirewallController_compileDHCPRules: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
                fwcloud: {"in":"path","name":"fwcloud","required":true,"dataType":"double"},
                firewallId: {"in":"path","name":"firewall","required":true,"dataType":"double"},
                ruleIds: {"in":"query","name":"rules","dataType":"array","array":{"dataType":"double"}},
        };
        app.get('/fwclouds/:fwcloud/firewalls/:firewall/system/dhcpRules/compile',
            authenticateMiddleware([{"sessionCookie":[]}]),
            ...(fetchMiddlewares<RequestHandler>(FirewallController)),
            ...(fetchMiddlewares<RequestHandler>(FirewallController.prototype.compileDHCPRules)),

            async function FirewallController_compileDHCPRules(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsFirewallController_compileDHCPRules, request, response });

                const controller = new FirewallController();

              await templateService.apiHandler({
                methodName: 'compileDHCPRules',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsFirewallController_compileKeepalivedRules: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
                fwcloud: {"in":"path","name":"fwcloud","required":true,"dataType":"double"},
                firewallId: {"in":"path","name":"firewall","required":true,"dataType":"double"},
                ruleIds: {"in":"query","name":"rules","dataType":"array","array":{"dataType":"double"}},
        };
        app.get('/fwclouds/:fwcloud/firewalls/:firewall/system/keepalivedRules/compile',
            authenticateMiddleware([{"sessionCookie":[]}]),
            ...(fetchMiddlewares<RequestHandler>(FirewallController)),
            ...(fetchMiddlewares<RequestHandler>(FirewallController.prototype.compileKeepalivedRules)),

            async function FirewallController_compileKeepalivedRules(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsFirewallController_compileKeepalivedRules, request, response });

                const controller = new FirewallController();

              await templateService.apiHandler({
                methodName: 'compileKeepalivedRules',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsFirewallController_pingCommunication: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
                requestBody: {"in":"body","name":"requestBody","required":true,"ref":"PingDto"},
                fwcloud: {"in":"path","name":"fwcloud","required":true,"dataType":"double"},
        };
        app.post('/fwclouds/:fwcloud/firewalls/communication/ping',
            authenticateMiddleware([{"sessionCookie":[],"confirmToken":[]}]),
            ...(fetchMiddlewares<RequestHandler>(FirewallController)),
            ...(fetchMiddlewares<RequestHandler>(FirewallController.prototype.pingCommunication)),

            async function FirewallController_pingCommunication(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsFirewallController_pingCommunication, request, response });

                const controller = new FirewallController();

              await templateService.apiHandler({
                methodName: 'pingCommunication',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsFirewallController_infoCommunication: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
                requestBody: {"in":"body","name":"requestBody","required":true,"ref":"InfoDto"},
                fwcloud: {"in":"path","name":"fwcloud","required":true,"dataType":"double"},
        };
        app.post('/fwclouds/:fwcloud/firewalls/communication/info',
            authenticateMiddleware([{"sessionCookie":[],"confirmToken":[]}]),
            ...(fetchMiddlewares<RequestHandler>(FirewallController)),
            ...(fetchMiddlewares<RequestHandler>(FirewallController.prototype.infoCommunication)),

            async function FirewallController_infoCommunication(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsFirewallController_infoCommunication, request, response });

                const controller = new FirewallController();

              await templateService.apiHandler({
                methodName: 'infoCommunication',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsFirewallController_installPlugin: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
                requestBody: {"in":"body","name":"requestBody","required":true,"ref":"PluginDto"},
                fwcloud: {"in":"path","name":"fwcloud","required":true,"dataType":"double"},
        };
        app.post('/fwclouds/:fwcloud/firewalls/plugin',
            authenticateMiddleware([{"sessionCookie":[],"confirmToken":[]}]),
            ...(fetchMiddlewares<RequestHandler>(FirewallController)),
            ...(fetchMiddlewares<RequestHandler>(FirewallController.prototype.installPlugin)),

            async function FirewallController_installPlugin(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsFirewallController_installPlugin, request, response });

                const controller = new FirewallController();

              await templateService.apiHandler({
                methodName: 'installPlugin',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsUserLegacyController_login: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyLoginRequest"},
        };
        app.post('/user/login',
            ...(fetchMiddlewares<RequestHandler>(UserLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(UserLegacyController.prototype.login)),

            async function UserLegacyController_login(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsUserLegacyController_login, request, response });

                const controller = new UserLegacyController();

              await templateService.apiHandler({
                methodName: 'login',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsUserLegacyController_logout: Record<string, TsoaRoute.ParameterSchema> = {
        };
        app.post('/user/logout',
            authenticateMiddleware([{"sessionCookie":[],"confirmToken":[]}]),
            ...(fetchMiddlewares<RequestHandler>(UserLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(UserLegacyController.prototype.logout)),

            async function UserLegacyController_logout(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsUserLegacyController_logout, request, response });

                const controller = new UserLegacyController();

              await templateService.apiHandler({
                methodName: 'logout',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsUserLegacyController_store: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyUserUpsertRequest"},
        };
        app.post('/user',
            authenticateMiddleware([{"sessionCookie":[],"confirmToken":[]}]),
            ...(fetchMiddlewares<RequestHandler>(UserLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(UserLegacyController.prototype.store)),

            async function UserLegacyController_store(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsUserLegacyController_store, request, response });

                const controller = new UserLegacyController();

              await templateService.apiHandler({
                methodName: 'store',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsUserLegacyController_update: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyUserUpsertRequest"},
        };
        app.put('/user',
            authenticateMiddleware([{"sessionCookie":[],"confirmToken":[]}]),
            ...(fetchMiddlewares<RequestHandler>(UserLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(UserLegacyController.prototype.update)),

            async function UserLegacyController_update(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsUserLegacyController_update, request, response });

                const controller = new UserLegacyController();

              await templateService.apiHandler({
                methodName: 'update',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsUserLegacyController_changePass: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyChangePasswordRequest"},
        };
        app.put('/user/changepass',
            authenticateMiddleware([{"sessionCookie":[],"confirmToken":[]}]),
            ...(fetchMiddlewares<RequestHandler>(UserLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(UserLegacyController.prototype.changePass)),

            async function UserLegacyController_changePass(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsUserLegacyController_changePass, request, response });

                const controller = new UserLegacyController();

              await templateService.apiHandler({
                methodName: 'changePass',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsUserLegacyController_get: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyUserGetRequest"},
        };
        app.put('/user/get',
            authenticateMiddleware([{"sessionCookie":[]}]),
            ...(fetchMiddlewares<RequestHandler>(UserLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(UserLegacyController.prototype.get)),

            async function UserLegacyController_get(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsUserLegacyController_get, request, response });

                const controller = new UserLegacyController();

              await templateService.apiHandler({
                methodName: 'get',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsUserLegacyController_delete: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyUserDeleteRequest"},
        };
        app.put('/user/del',
            authenticateMiddleware([{"sessionCookie":[],"confirmToken":[]}]),
            ...(fetchMiddlewares<RequestHandler>(UserLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(UserLegacyController.prototype.delete)),

            async function UserLegacyController_delete(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsUserLegacyController_delete, request, response });

                const controller = new UserLegacyController();

              await templateService.apiHandler({
                methodName: 'delete',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsUserLegacyController_restricted: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyUserRestrictedRequest"},
        };
        app.put('/user/restricted',
            authenticateMiddleware([{"sessionCookie":[]}]),
            ...(fetchMiddlewares<RequestHandler>(UserLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(UserLegacyController.prototype.restricted)),

            async function UserLegacyController_restricted(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsUserLegacyController_restricted, request, response });

                const controller = new UserLegacyController();

              await templateService.apiHandler({
                methodName: 'restricted',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsUserLegacyController_enableFwCloudAccess: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyUserFwCloudAccessRequest"},
        };
        app.post('/user/fwcloud',
            authenticateMiddleware([{"sessionCookie":[],"confirmToken":[]}]),
            ...(fetchMiddlewares<RequestHandler>(UserLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(UserLegacyController.prototype.enableFwCloudAccess)),

            async function UserLegacyController_enableFwCloudAccess(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsUserLegacyController_enableFwCloudAccess, request, response });

                const controller = new UserLegacyController();

              await templateService.apiHandler({
                methodName: 'enableFwCloudAccess',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsUserLegacyController_disableFwCloudAccess: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyUserFwCloudAccessRequest"},
        };
        app.put('/user/fwcloud/del',
            authenticateMiddleware([{"sessionCookie":[],"confirmToken":[]}]),
            ...(fetchMiddlewares<RequestHandler>(UserLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(UserLegacyController.prototype.disableFwCloudAccess)),

            async function UserLegacyController_disableFwCloudAccess(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsUserLegacyController_disableFwCloudAccess, request, response });

                const controller = new UserLegacyController();

              await templateService.apiHandler({
                methodName: 'disableFwCloudAccess',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsUserLegacyController_listFwCloudAccess: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyUserFwCloudAccessListRequest"},
        };
        app.put('/user/fwcloud/get',
            authenticateMiddleware([{"sessionCookie":[]}]),
            ...(fetchMiddlewares<RequestHandler>(UserLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(UserLegacyController.prototype.listFwCloudAccess)),

            async function UserLegacyController_listFwCloudAccess(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsUserLegacyController_listFwCloudAccess, request, response });

                const controller = new UserLegacyController();

              await templateService.apiHandler({
                methodName: 'listFwCloudAccess',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsFwcloudLegacyController_getAllowed: Record<string, TsoaRoute.ParameterSchema> = {
        };
        app.get('/fwcloud/all/get',
            authenticateMiddleware([{"sessionCookie":[]}]),
            ...(fetchMiddlewares<RequestHandler>(FwcloudLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(FwcloudLegacyController.prototype.getAllowed)),

            async function FwcloudLegacyController_getAllowed(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsFwcloudLegacyController_getAllowed, request, response });

                const controller = new FwcloudLegacyController();

              await templateService.apiHandler({
                methodName: 'getAllowed',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsFwcloudLegacyController_get: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyFwcloudRequest"},
        };
        app.put('/fwcloud/get',
            authenticateMiddleware([{"sessionCookie":[]}]),
            ...(fetchMiddlewares<RequestHandler>(FwcloudLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(FwcloudLegacyController.prototype.get)),

            async function FwcloudLegacyController_get(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsFwcloudLegacyController_get, request, response });

                const controller = new FwcloudLegacyController();

              await templateService.apiHandler({
                methodName: 'get',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsFwcloudLegacyController_restricted: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyFwcloudRequest"},
        };
        app.put('/fwcloud/restricted',
            authenticateMiddleware([{"sessionCookie":[]}]),
            ...(fetchMiddlewares<RequestHandler>(FwcloudLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(FwcloudLegacyController.prototype.restricted)),

            async function FwcloudLegacyController_restricted(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsFwcloudLegacyController_restricted, request, response });

                const controller = new FwcloudLegacyController();

              await templateService.apiHandler({
                methodName: 'restricted',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsFwcloudLegacyController_delete: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyFwcloudRequest"},
        };
        app.put('/fwcloud/del',
            authenticateMiddleware([{"sessionCookie":[],"confirmToken":[]}]),
            ...(fetchMiddlewares<RequestHandler>(FwcloudLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(FwcloudLegacyController.prototype.delete)),

            async function FwcloudLegacyController_delete(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsFwcloudLegacyController_delete, request, response });

                const controller = new FwcloudLegacyController();

              await templateService.apiHandler({
                methodName: 'delete',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsFwcloudLegacyController_lock: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyFwcloudRequest"},
        };
        app.put('/fwcloud/lock',
            authenticateMiddleware([{"sessionCookie":[],"confirmToken":[]}]),
            ...(fetchMiddlewares<RequestHandler>(FwcloudLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(FwcloudLegacyController.prototype.lock)),

            async function FwcloudLegacyController_lock(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsFwcloudLegacyController_lock, request, response });

                const controller = new FwcloudLegacyController();

              await templateService.apiHandler({
                methodName: 'lock',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsFwcloudLegacyController_unlock: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyFwcloudRequest"},
        };
        app.put('/fwcloud/unlock',
            authenticateMiddleware([{"sessionCookie":[],"confirmToken":[]}]),
            ...(fetchMiddlewares<RequestHandler>(FwcloudLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(FwcloudLegacyController.prototype.unlock)),

            async function FwcloudLegacyController_unlock(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsFwcloudLegacyController_unlock, request, response });

                const controller = new FwcloudLegacyController();

              await templateService.apiHandler({
                methodName: 'unlock',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsFwcloudLegacyController_forceUnlock: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyFwcloudRequest"},
        };
        app.put('/fwcloud/forcelock',
            authenticateMiddleware([{"sessionCookie":[],"confirmToken":[]}]),
            ...(fetchMiddlewares<RequestHandler>(FwcloudLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(FwcloudLegacyController.prototype.forceUnlock)),

            async function FwcloudLegacyController_forceUnlock(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsFwcloudLegacyController_forceUnlock, request, response });

                const controller = new FwcloudLegacyController();

              await templateService.apiHandler({
                methodName: 'forceUnlock',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsFirewallLegacyController_store: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyFirewallStoreRequest"},
        };
        app.post('/firewall',
            authenticateMiddleware([{"sessionCookie":[],"confirmToken":[]}]),
            ...(fetchMiddlewares<RequestHandler>(FirewallLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(FirewallLegacyController.prototype.store)),

            async function FirewallLegacyController_store(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsFirewallLegacyController_store, request, response });

                const controller = new FirewallLegacyController();

              await templateService.apiHandler({
                methodName: 'store',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsFirewallLegacyController_update: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyFirewallUpdateRequest"},
        };
        app.put('/firewall',
            authenticateMiddleware([{"sessionCookie":[],"confirmToken":[]}]),
            ...(fetchMiddlewares<RequestHandler>(FirewallLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(FirewallLegacyController.prototype.update)),

            async function FirewallLegacyController_update(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsFirewallLegacyController_update, request, response });

                const controller = new FirewallLegacyController();

              await templateService.apiHandler({
                methodName: 'update',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsFirewallLegacyController_get: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyFirewallGetRequest"},
        };
        app.put('/firewall/get',
            authenticateMiddleware([{"sessionCookie":[]}]),
            ...(fetchMiddlewares<RequestHandler>(FirewallLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(FirewallLegacyController.prototype.get)),

            async function FirewallLegacyController_get(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsFirewallLegacyController_get, request, response });

                const controller = new FirewallLegacyController();

              await templateService.apiHandler({
                methodName: 'get',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsFirewallLegacyController_getByCloud: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyFirewallCloudRequest"},
        };
        app.put('/firewall/cloud/get',
            authenticateMiddleware([{"sessionCookie":[]}]),
            ...(fetchMiddlewares<RequestHandler>(FirewallLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(FirewallLegacyController.prototype.getByCloud)),

            async function FirewallLegacyController_getByCloud(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsFirewallLegacyController_getByCloud, request, response });

                const controller = new FirewallLegacyController();

              await templateService.apiHandler({
                methodName: 'getByCloud',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsFirewallLegacyController_getByCluster: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyFirewallClusterRequest"},
        };
        app.put('/firewall/cluster/get',
            authenticateMiddleware([{"sessionCookie":[]}]),
            ...(fetchMiddlewares<RequestHandler>(FirewallLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(FirewallLegacyController.prototype.getByCluster)),

            async function FirewallLegacyController_getByCluster(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsFirewallLegacyController_getByCluster, request, response });

                const controller = new FirewallLegacyController();

              await templateService.apiHandler({
                methodName: 'getByCluster',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsFirewallLegacyController_clone: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyFirewallCloneRequest"},
        };
        app.put('/firewall/clone',
            authenticateMiddleware([{"sessionCookie":[],"confirmToken":[]}]),
            ...(fetchMiddlewares<RequestHandler>(FirewallLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(FirewallLegacyController.prototype.clone)),

            async function FirewallLegacyController_clone(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsFirewallLegacyController_clone, request, response });

                const controller = new FirewallLegacyController();

              await templateService.apiHandler({
                methodName: 'clone',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsFirewallLegacyController_destroy: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyFirewallGetRequest"},
        };
        app.put('/firewall/del',
            authenticateMiddleware([{"sessionCookie":[],"confirmToken":[]}]),
            ...(fetchMiddlewares<RequestHandler>(FirewallLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(FirewallLegacyController.prototype.destroy)),

            async function FirewallLegacyController_destroy(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsFirewallLegacyController_destroy, request, response });

                const controller = new FirewallLegacyController();

              await templateService.apiHandler({
                methodName: 'destroy',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsCustomerLegacyController_store: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyCustomerUpsertRequest"},
        };
        app.post('/customer',
            authenticateMiddleware([{"sessionCookie":[],"confirmToken":[]}]),
            ...(fetchMiddlewares<RequestHandler>(CustomerLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(CustomerLegacyController.prototype.store)),

            async function CustomerLegacyController_store(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsCustomerLegacyController_store, request, response });

                const controller = new CustomerLegacyController();

              await templateService.apiHandler({
                methodName: 'store',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsCustomerLegacyController_update: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyCustomerUpsertRequest"},
        };
        app.put('/customer',
            authenticateMiddleware([{"sessionCookie":[],"confirmToken":[]}]),
            ...(fetchMiddlewares<RequestHandler>(CustomerLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(CustomerLegacyController.prototype.update)),

            async function CustomerLegacyController_update(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsCustomerLegacyController_update, request, response });

                const controller = new CustomerLegacyController();

              await templateService.apiHandler({
                methodName: 'update',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsCustomerLegacyController_get: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyCustomerRequest"},
        };
        app.put('/customer/get',
            authenticateMiddleware([{"sessionCookie":[]}]),
            ...(fetchMiddlewares<RequestHandler>(CustomerLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(CustomerLegacyController.prototype.get)),

            async function CustomerLegacyController_get(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsCustomerLegacyController_get, request, response });

                const controller = new CustomerLegacyController();

              await templateService.apiHandler({
                methodName: 'get',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsCustomerLegacyController_delete: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyCustomerRequest"},
        };
        app.put('/customer/del',
            authenticateMiddleware([{"sessionCookie":[],"confirmToken":[]}]),
            ...(fetchMiddlewares<RequestHandler>(CustomerLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(CustomerLegacyController.prototype.delete)),

            async function CustomerLegacyController_delete(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsCustomerLegacyController_delete, request, response });

                const controller = new CustomerLegacyController();

              await templateService.apiHandler({
                methodName: 'delete',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsCustomerLegacyController_restricted: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyCustomerRequest"},
        };
        app.put('/customer/restricted',
            authenticateMiddleware([{"sessionCookie":[]}]),
            ...(fetchMiddlewares<RequestHandler>(CustomerLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(CustomerLegacyController.prototype.restricted)),

            async function CustomerLegacyController_restricted(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsCustomerLegacyController_restricted, request, response });

                const controller = new CustomerLegacyController();

              await templateService.apiHandler({
                methodName: 'restricted',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsClusterLegacyController_store: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyClusterStoreRequest"},
        };
        app.post('/cluster',
            authenticateMiddleware([{"sessionCookie":[],"confirmToken":[]}]),
            ...(fetchMiddlewares<RequestHandler>(ClusterLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(ClusterLegacyController.prototype.store)),

            async function ClusterLegacyController_store(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsClusterLegacyController_store, request, response });

                const controller = new ClusterLegacyController();

              await templateService.apiHandler({
                methodName: 'store',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsClusterLegacyController_get: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyClusterGetRequest"},
        };
        app.put('/cluster/get',
            authenticateMiddleware([{"sessionCookie":[]}]),
            ...(fetchMiddlewares<RequestHandler>(ClusterLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(ClusterLegacyController.prototype.get)),

            async function ClusterLegacyController_get(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsClusterLegacyController_get, request, response });

                const controller = new ClusterLegacyController();

              await templateService.apiHandler({
                methodName: 'get',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsClusterLegacyController_getByCloud: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyClusterGetByCloudRequest"},
        };
        app.put('/cluster/cloud/get',
            authenticateMiddleware([{"sessionCookie":[]}]),
            ...(fetchMiddlewares<RequestHandler>(ClusterLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(ClusterLegacyController.prototype.getByCloud)),

            async function ClusterLegacyController_getByCloud(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsClusterLegacyController_getByCloud, request, response });

                const controller = new ClusterLegacyController();

              await templateService.apiHandler({
                methodName: 'getByCloud',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsClusterLegacyController_update: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyClusterUpdateRequest"},
        };
        app.put('/cluster',
            authenticateMiddleware([{"sessionCookie":[],"confirmToken":[]}]),
            ...(fetchMiddlewares<RequestHandler>(ClusterLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(ClusterLegacyController.prototype.update)),

            async function ClusterLegacyController_update(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsClusterLegacyController_update, request, response });

                const controller = new ClusterLegacyController();

              await templateService.apiHandler({
                methodName: 'update',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsClusterLegacyController_firewallToCluster: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyClusterFirewallToClusterRequest"},
        };
        app.put('/cluster/fwtocluster',
            authenticateMiddleware([{"sessionCookie":[],"confirmToken":[]}]),
            ...(fetchMiddlewares<RequestHandler>(ClusterLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(ClusterLegacyController.prototype.firewallToCluster)),

            async function ClusterLegacyController_firewallToCluster(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsClusterLegacyController_firewallToCluster, request, response });

                const controller = new ClusterLegacyController();

              await templateService.apiHandler({
                methodName: 'firewallToCluster',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsClusterLegacyController_clusterToFirewall: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyClusterClusterToFirewallRequest"},
        };
        app.put('/cluster/clustertofw',
            authenticateMiddleware([{"sessionCookie":[],"confirmToken":[]}]),
            ...(fetchMiddlewares<RequestHandler>(ClusterLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(ClusterLegacyController.prototype.clusterToFirewall)),

            async function ClusterLegacyController_clusterToFirewall(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsClusterLegacyController_clusterToFirewall, request, response });

                const controller = new ClusterLegacyController();

              await templateService.apiHandler({
                methodName: 'clusterToFirewall',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsClusterLegacyController_clone: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyClusterCloneRequest"},
        };
        app.put('/cluster/clone',
            authenticateMiddleware([{"sessionCookie":[],"confirmToken":[]}]),
            ...(fetchMiddlewares<RequestHandler>(ClusterLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(ClusterLegacyController.prototype.clone)),

            async function ClusterLegacyController_clone(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsClusterLegacyController_clone, request, response });

                const controller = new ClusterLegacyController();

              await templateService.apiHandler({
                methodName: 'clone',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 200,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsClusterLegacyController_restricted: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyClusterGetRequest"},
        };
        app.put('/cluster/restricted',
            authenticateMiddleware([{"sessionCookie":[]}]),
            ...(fetchMiddlewares<RequestHandler>(ClusterLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(ClusterLegacyController.prototype.restricted)),

            async function ClusterLegacyController_restricted(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsClusterLegacyController_restricted, request, response });

                const controller = new ClusterLegacyController();

              await templateService.apiHandler({
                methodName: 'restricted',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsClusterLegacyController_delete: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","ref":"LegacyClusterGetRequest"},
        };
        app.put('/cluster/del',
            authenticateMiddleware([{"sessionCookie":[],"confirmToken":[]}]),
            ...(fetchMiddlewares<RequestHandler>(ClusterLegacyController)),
            ...(fetchMiddlewares<RequestHandler>(ClusterLegacyController.prototype.delete)),

            async function ClusterLegacyController_delete(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsClusterLegacyController_delete, request, response });

                const controller = new ClusterLegacyController();

              await templateService.apiHandler({
                methodName: 'delete',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa


    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

    function authenticateMiddleware(security: TsoaRoute.Security[] = []) {
        return async function runAuthenticationMiddleware(request: any, response: any, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            // keep track of failed auth attempts so we can hand back the most
            // recent one.  This behavior was previously existing so preserving it
            // here
            const failedAttempts: any[] = [];
            const pushAndRethrow = (error: any) => {
                failedAttempts.push(error);
                throw error;
            };

            const secMethodOrPromises: Promise<any>[] = [];
            for (const secMethod of security) {
                if (Object.keys(secMethod).length > 1) {
                    const secMethodAndPromises: Promise<any>[] = [];

                    for (const name in secMethod) {
                        secMethodAndPromises.push(
                            expressAuthenticationRecasted(request, name, secMethod[name], response)
                                .catch(pushAndRethrow)
                        );
                    }

                    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

                    secMethodOrPromises.push(Promise.all(secMethodAndPromises)
                        .then(users => { return users[0]; }));
                } else {
                    for (const name in secMethod) {
                        secMethodOrPromises.push(
                            expressAuthenticationRecasted(request, name, secMethod[name], response)
                                .catch(pushAndRethrow)
                        );
                    }
                }
            }

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            try {
                request['user'] = await Promise.any(secMethodOrPromises);

                // Response was sent in middleware, abort
                if (response.writableEnded) {
                    return;
                }

                next();
            }
            catch(err) {
                // Show most recent error as response
                const error = failedAttempts.pop();
                error.status = error.status || 401;

                // Response was sent in middleware, abort
                if (response.writableEnded) {
                    return;
                }
                next(error);
            }

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        }
    }

    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
}

// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
