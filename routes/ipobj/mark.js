var express = require('express');
var router = express.Router();

var api_resp = require('../../utils/api_response');

var objModel = 'IptablesMark';

const markModel = require('../../models/ipobj/mark');
const fwcTreeModel = require('../../models/tree/tree');
const policy_cModel = require('../../models/policy/policy_c');
const restrictedCheck = require('../../middleware/restricted');


/**
 * Create a new iptables mark.
 */
router.post('/', async (req, res) => {
	try {
		if (req.tree_node.node_type !== 'MRK')
			return api_resp.getJson(null, api_resp.ACR_ERROR, 'Bad tree node type', objModel, null, jsonResp => res.status(200).json(jsonResp));

    // Verify that we are not creating an iptables mark that already exists for this fwcloud.
		if (await markModel.existsMark(req.dbCon,req.body.fwcloud,req.body.code)) 
			return api_resp.getJson(null, api_resp.ACR_ALREADY_EXISTS, 'Iptables mark already exists', objModel, null, jsonResp => res.status(200).json(jsonResp));

		// Create the new iptables mark for the indicated fwcloud.
		const id = await markModel.createMark(req);

		// Create the iptables mark node in the ipobj tree.
		let nodeId = await fwcTreeModel.newNode(req.dbCon, req.body.fwcloud, req.body.name, req.body.node_id, 'MRK', id, 30);

		api_resp.getJson({insertId: id, TreeinsertId: nodeId}, api_resp.ACR_INSERTED_OK, 'INSERTED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
  } catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error creating iptables mark', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/**
 * Modify an iptables mark.
 */
router.put('/', async (req, res) => {
	try {
		// Verify that we the new iptables mark doesn't already exists for this fwcloud.
		const existsId = await markModel.existsMark(req.dbCon,req.body.fwcloud,req.body.code);
		if (existsId && existsId!==req.body.mark) 
			return api_resp.getJson(null, api_resp.ACR_ALREADY_EXISTS, 'Iptables mark already exists', objModel, null, jsonResp => res.status(200).json(jsonResp));

		// Invalidate the compilation of the rules that use this mark.
		const search = await markModel.searchMarkUsage(req.dbCon,req.body.fwcloud,req.body.mark);
		await policy_cModel.deleteRulesCompilation(req.body.fwcloud,search.restrictions.MarkInRule);

   	// Modify the mark data.
		await markModel.modifyMark(req);

		api_resp.getJson(null, api_resp.ACR_OK, 'UPDATE OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
  } catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error modifying iptables mark', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


/**
 * Delete an iptables mark.
 */
router.put('/del', 
restrictedCheck.mark,
async (req, res) => {
	try {
		// Delete iptables mark.
		await markModel.deleteMark(req.dbCon,req.body.mark);

		api_resp.getJson(null, api_resp.ACR_OK, 'REMOVED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
  } catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error deleting an iptables mark', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});

// API call for check deleting restrictions.
router.put('/restricted',
	restrictedCheck.mark,
	(req, res) => api_resp.getJson(null, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp)));


router.put('/where', async (req, res) => {
	try {
		const data = await markModel.searchMarkUsage(req.dbCon,req.body.fwcloud,req.body.mark);
		api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});


module.exports = router;