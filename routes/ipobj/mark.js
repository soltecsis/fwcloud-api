var express = require('express');
var router = express.Router();

const markModel = require('../../models/ipobj/mark');
const fwcTreeModel = require('../../models/tree/tree');
const policy_cModel = require('../../models/policy/policy_c');
const restrictedCheck = require('../../middleware/restricted');
const fwcError = require('../../utils/error_table');


/**
 * Create a new iptables mark.
 */
router.post('/', async (req, res) => {
	try {
		if (req.tree_node.node_type !== 'MRK')
			throw fwcError.BAD_TREE_NODE_TYPE;

    // Verify that we are not creating an iptables mark that already exists for this fwcloud.
		if (await markModel.existsMark(req.dbCon,req.body.fwcloud,req.body.code)) 
			throw fwcError.ALREADY_EXISTS;

		// Create the new iptables mark for the indicated fwcloud.
		const id = await markModel.createMark(req);

		// Create the iptables mark node in the ipobj tree.
		let nodeId = await fwcTreeModel.newNode(req.dbCon, req.body.fwcloud, req.body.name, req.body.node_id, 'MRK', id, 30);

		res.status(200).json({insertId: id, TreeinsertId: nodeId});
	} catch(error) { res.status(400).json(error) }
});


/**
 * Modify an iptables mark.
 */
router.put('/', async (req, res) => {
	try {
		// Verify that we the new iptables mark doesn't already exists for this fwcloud.
		const existsId = await markModel.existsMark(req.dbCon,req.body.fwcloud,req.body.code);
		if (existsId && existsId!==req.body.mark) 
			throw fwcError.ALREADY_EXISTS;

		// Invalidate the compilation of the rules that use this mark.
		const search = await markModel.searchMarkUsage(req.dbCon,req.body.fwcloud,req.body.mark);
		await policy_cModel.deleteRulesCompilation(req.body.fwcloud,search.restrictions.MarkInRule);

   	// Modify the mark data.
		await markModel.modifyMark(req);

		res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});


/**
 * Get mark data.
 */
router.put('/get', async(req, res) => {
	try {
		const data = await markModel.getMark(req.dbCon,req.body.mark);
		res.status(200).json(data);
	} catch(error) { res.status(400).json(error) }
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

		res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});


// API call for check deleting restrictions.
router.put('/restricted', restrictedCheck.mark, (req, res) => res.status(204).end());


router.put('/where', async (req, res) => {
	try {
		const data = await markModel.searchMarkUsage(req.dbCon,req.body.fwcloud,req.body.mark);
		if (data.result)
			res.status(200).json(data);
		else
			res.status(204).end();
	} catch(error) { res.status(400).json(error) }
});

module.exports = router;