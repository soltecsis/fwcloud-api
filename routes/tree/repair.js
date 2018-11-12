var express = require('express');
var router = express.Router();
const lockFile = require('proper-lockfile');
const fs = require('fs');

const fwcTreeRepairModel = require('../../models/tree/repair');
const api_resp = require('../../utils/api_response');
const streamModel = require('../../models/stream/stream');
const config = require('../../config/config');

var objModel = 'FWC TREE REPAIR';


/* Rpair tree */
router.put('/', async (req, res) =>{
  let lockFilePath = config.get('policy').data_dir+"/"+req.body.fwcloud;
  if (!fs.existsSync(lockFilePath))
    fs.mkdirSync(lockFilePath);
  lockFilePath += "/"+req.body.fwcloud;

  const accessData = {sessionID: req.sessionID, iduser: req.session.user_id};
    
	try {
    if (!fs.existsSync(lockFilePath))
      fs.closeSync(fs.openSync(lockFilePath,'w'));

    if (req.body.type==='FDF')
      streamModel.pushMessageCompile(accessData,'<font color="blue">REPAIRING FIREWALLS/CLUSTERS TREE FOR CLOUD WITH ID: '+req.body.fwcloud+'</font>\n');
    else if (req.body.type==='FDO')
      streamModel.pushMessageCompile(accessData,'<font color="blue">REPAIRING OBJECTS TREE FOR CLOUD WITH ID: '+req.body.fwcloud+'</font>\n');
    else if (req.body.type==='FDS')
      streamModel.pushMessageCompile(accessData,'<font color="blue">REPAIRING SERVICES TREE FOR CLOUD WITH ID: '+req.body.fwcloud+'</font>\n');
    else
      return api_resp.getJson(null, api_resp.ACR_ERROR, 'Invalid tree node type', objModel, null, jsonResp => res.status(200).json(jsonResp));
    
    await fwcTreeRepairModel.initData(req);

    streamModel.pushMessageCompile(accessData,'<font color="blue">REPAIRING TREE FOR CLOUD WITH ID: '+req.body.fwcloud+'</font>\n');

    // MUTUAL EXCLUSION ACCESS
    const release = await lockFile.lock(lockFilePath);
    const rootNodes = await fwcTreeRepairModel.checkRootNodes();

    // Verify that all tree not root nodes are part of a tree.
    streamModel.pushMessageCompile(accessData,'<font color="blue">Checking tree struture.</font>\n');
    await fwcTreeRepairModel.checkNotRootNodes(rootNodes);

    for (let rootNode of rootNodes) {
      if (rootNode.node_type==='FDF' && req.body.type==='FDF') { // Firewalls and clusters tree.
        streamModel.pushMessageCompile(accessData,'<font color="blue">Checking folders.</font>\n');
        await fwcTreeRepairModel.checkFirewallsFoldersContent(rootNode);
        streamModel.pushMessageCompile(accessData,'<font color="blue">Checking firewalls and clusters tree.</font>\n');
        await fwcTreeRepairModel.checkFirewallsInTree(rootNode);
        await fwcTreeRepairModel.checkClustersInTree(rootNode);
        break;
      }
      else if (rootNode.node_type==='FDO' && req.body.type==='FDO') { // Objects tree.
        streamModel.pushMessageCompile(accessData,'<font color="blue">Checking host objects.</font>\n');
        await fwcTreeRepairModel.checkHostObjects(rootNode);
        break;
      }
      else if (rootNode.node_type==='FDS' && req.body.type==='FDS') { // Services tree.
        streamModel.pushMessageCompile(accessData,'<font color="blue">Checking services tree.</font>\n');
        break;
      }
    }

    // EXIT MUTEX
    await release();

    api_resp.getJson(null, api_resp.ACR_OK, 'REPAIR PROCESS COMPLETED', objModel, null, jsonResp => res.status(200).json(jsonResp));
  } catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error repairing tree', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});

module.exports = router;