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

var utilsModel = require("../../utils/utils.js");

const POLICY_TYPE = ['', 'INPUT', 'OUTPUT', 'FORWARD', 'SNAT', 'DNAT'];



/*----------------------------------------------------------------------------------------------------------------------*/
/* Compile a firewall rule. */
/*----------------------------------------------------------------------------------------------------------------------*/
router.get('/:iduser/:fwcloud/:fw/:type/:rule',utilsModel.checkFwCloudAccess(true), (req, res) => {
    var user = req.params.iduser;
    var cloud = req.params.fwcloud;
    var fw = req.params.fw;
    var type = req.params.type;
    var rule = req.params.rule;

    /* The get method of the RuleCompile model returns a promise. */
    RuleCompile.get(cloud, fw, type, rule)
            .then(data => api_resp.getJson({"result": true, "cs": data}, api_resp.ACR_OK, '', 'COMPILE', null, jsonResp => res.status(200).json(jsonResp)))
            .catch(error => api_resp.getJson(error, api_resp.ACR_ERROR, '', 'COMPILE', error, jsonResp => res.status(200).json(jsonResp)));
});
/*----------------------------------------------------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------------------------------------------------*/
/* Compile a firewall. */
/*----------------------------------------------------------------------------------------------------------------------*/
router.get('/:iduser/:fwcloud/:fw',utilsModel.checkFwCloudAccess(true), (req, res) => {
    var user = req.params.iduser;
    var cloud = req.params.fwcloud;
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

    var accessData = {sessionID: req.sessionID, iduser: user, fwcloud: cloud};
    streamModel.pushMessageCompile(accessData, "STARTING FIREWALL COMPILATION PROCESS\n");

    stream.on('open', async fd => {
        /* Generate the policy script. */
        await PolicyScript.append(config.policy.header_file)
                .then(data => {
                    streamModel.pushMessageCompile(accessData, "\nINPUT TABLE:\n");
                    stream.write(data + "log \"FWCloud.net - Loading firewall policy generated: " + Date() + "\"" + "\n\necho -e \"\\nINPUT TABLE\\n-----------\"\n");
                    return PolicyScript.dump(accessData,cloud, fw, 1)
                })
                .then(data => {
                    streamModel.pushMessageCompile(accessData, "\nOUTPUT TABLE\n");
                    stream.write(data + "\n\necho -e \"\\nOUTPUT TABLE\\n------------\"\n");
                    return PolicyScript.dump(accessData,cloud, fw, 2)
                })
                .then(data => {
                    streamModel.pushMessageCompile(accessData, "\nFORWARD TABLE\n");
                    stream.write(data + "\n\necho -e \"\\nFORWARD TABLE\\n-------------\"\n");
                    return PolicyScript.dump(accessData,cloud, fw, 3)
                })
                .then(data => {
                    streamModel.pushMessageCompile(accessData, "\nSNAT TABLE\n");
                    stream.write(data + "\n\necho -e \"\\nSNAT TABLE\\n----------\"\n");
                    return PolicyScript.dump(accessData,cloud, fw, 4)
                })
                .then(data => {
                    streamModel.pushMessageCompile(accessData, "\nDNAT TABLE\n");
                    stream.write(data + "\n\necho -e \"\\nDNAT TABLE\\n----------\"\n");
                    return PolicyScript.dump(accessData,cloud, fw, 5)
                })
                .then(data => {
                    stream.write(data);
                    return PolicyScript.append(config.policy.footer_file)
                })
                .then(data => {
                    stream.write(data);
                    streamModel.pushMessageCompile(accessData, "\nCOMPILATION COMPLETED\n\n");
                    api_resp.getJson(null, api_resp.ACR_OK, '', 'COMPILE', null, jsonResp => res.status(200).json(jsonResp));
                })
                .catch(error => api_resp.getJson(null, api_resp.ACR_ERROR, '', 'COMPILE', error, jsonResp => res.status(200).json(jsonResp)));

        /* Close stream. */
        stream.end();

    }).on('error', error => api_resp.getJson(null, api_resp.ACR_ERROR, '', 'COMPILE', error, jsonResp => res.status(200).json(jsonResp)))
});
/*----------------------------------------------------------------------------------------------------------------------*/

module.exports = router;

