/**
 * Module to routing COMPILE requests
 * <br>BASE ROUTE CALL: <b>/policy/compile</b>
 *
 * @module Compile
 *
 * @requires express
 * @requires Policy_rModel
 *
 */


/**
 * Class to manage Compile Policy
 *
 * @class CompileRouter
 */


/**
 * Property  to manage express
 *
 * @property express
 * @type express
 */
var express = require('express');
/**
 * Property  to manage  route
 *
 * @property router
 * @type express.Router
 */
var router = express.Router();

/**
 * Property Logger to manage App logs
 *
 * @property logger
 * @type log4js/app
 *
 */
var logger = require('log4js').getLogger("compiler");
/**
 * Property Model to manage API RESPONSE data
 *
 * @property api_resp
 * @type ../../models/api_response
 *
 */
var api_resp = require('../../utils/api_response');

/**
 * Property Model to manage compilation process
 *
 * @property RuleCompileModel
 * @type ../../models/compile/
 */
var RuleCompile = require('../../models/policy/rule_compile');

/**
 * Property Model to manage policy script generation and install process
 *
 * @property PolicyScript
 * @type ../../models/compile/
 */
var PolicyScript = require('../../models/policy/policy_script');

var streamModel = require('../../models/stream/stream');

var config = require('../../config/apiconf.json');

const POLICY_TYPE = ['', 'INPUT', 'OUTPUT', 'FORWARD', 'SNAT', 'DNAT'];



/*----------------------------------------------------------------------------------------------------------------------*/
/* Compile a firewall rule. */
/*----------------------------------------------------------------------------------------------------------------------*/
router.get('/:user/:cloud/:fw/:type/:rule', (req, res) => {
    var user = req.params.user;
    var cloud = req.params.cloud;
    var fw = req.params.fw;
    var type = req.params.type;
    var rule = req.params.rule;

    var accessData = {sessionID: req.sessionID, iduser: user, fwcloud: cloud};

    var strRule = " Rule: " + rule + " FWCloud: " + cloud + "  Firewall: " + fw + "  Type: " + type + "\n";

    streamModel.pushMessageCompile(accessData, "-------------------------------------------------");
    streamModel.pushMessageCompile(accessData, "START COMPILING RULE" + strRule);

    /* The get method of the RuleCompile model returns a promise. */
    RuleCompile.get(cloud, fw, type, rule)
            .then(data => {
                streamModel.pushMessageCompile(accessData, data);
                streamModel.pushMessageCompile(accessData, "OK - END COMPILED RULE" + strRule);

                api_resp.getJson({"result": true, "cs": data}, api_resp.ACR_OK, '', 'COMPILE', null, jsonResp => res.status(200).json(jsonResp));
            })
            .catch(error => {
                streamModel.pushMessageCompile(accessData, "ERROR - END COMPILED RULE " + strRule);
        
                api_resp.getJson(null, api_resp.ACR_ERROR, '', 'COMPILE', error, jsonResp => res.status(200).json(jsonResp));
            });
});
/*----------------------------------------------------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------------------------------------------------*/
/* Compile a firewall. */
/*----------------------------------------------------------------------------------------------------------------------*/
router.get('/:user/:cloud/:fw', (req, res) => {
    var user = req.params.user;
    var cloud = req.params.cloud;
    var fw = req.params.fw;
    var code = "";

    var fs = require('fs');
    var path = config.policy.data_dir;
    if (!fs.existsSync(path))
        fs.mkdirSync(path);
    path += "/" + cloud;
    if (!fs.existsSync(path))
        fs.mkdirSync(path);
    path += "/" + fw;
    if (!fs.existsSync(path))
        fs.mkdirSync(path);
    path += "/" + config.policy.script_name;
    var stream = fs.createWriteStream(path);

    stream.on('open', async fd => {
        /* Generate the policy script. */
        await PolicyScript.append(config.policy.header_file)
                .then(data => {
                    stream.write(data + "\n\necho -e \"\\nINPUT TABLE\\n-----------\"\n");
                    return PolicyScript.dump(cloud, fw, 1)
                })
                .then(data => {
                    stream.write(data + "\n\necho -e \"\\nOUTPUT TABLE\\n------------\"\n");
                    return PolicyScript.dump(cloud, fw, 2)
                })
                .then(data => {
                    stream.write(data + "\n\necho -e \"\\nFORWARD TABLE\\n-------------\"\n");
                    return PolicyScript.dump(cloud, fw, 3)
                })
                .then(data => {
                    stream.write(data + "\n\necho -e \"\\nSNAT TABLE\\n----------\"\n");
                    return PolicyScript.dump(cloud, fw, 4)
                })
                .then(data => {
                    stream.write(data + "\n\necho -e \"\\nDNAT TABLE\\n----------\"\n");
                    return PolicyScript.dump(cloud, fw, 5)
                })
                .then(data => {
                    stream.write(data);
                    return PolicyScript.append(config.policy.footer_file)
                })
                .then(data => {
                    stream.write(data);
                    res.status(200).send({"result": true, "msg": "Policy script path: " + path})
                })
                .catch(error => api_resp.getJson(null, api_resp.ACR_ERROR, '', 'COMPILE', error, jsonResp => res.status(200).json(jsonResp)));

        /* Close stream. */
        stream.end();

    }).on('error', error => api_resp.getJson(null, api_resp.ACR_ERROR, '', 'COMPILE', error, jsonResp => res.status(200).json(jsonResp)))
});
/*----------------------------------------------------------------------------------------------------------------------*/

module.exports = router;

