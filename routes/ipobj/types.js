var express = require('express');
var router = express.Router();
var Ipobj_typeModel = require('../../models/ipobj/ipobj_type');
const fwcError = require('../../utils/error_table');

/* Get all ipobj_types */
router.get('/', (req, res) => {
	Ipobj_typeModel.getIpobj_types((error, data) => {
    if (data && data.length > 0)
      res.status(200).json(data);
    else
			res.status(400).json(fwcError.NOT_FOUND);
	});
});

/* Get  ipobj_type by id */
router.put('/get', async (req, res) => {
	try {
		const data = await Ipobj_typeModel.getIpobj_type(req, req.body.id);		
    if (data && data.length > 0)
      res.status(200).json(data);
    else
			res.status(400).json(fwcError.NOT_FOUND);
	} catch(error) { res.status(400).json(error) }
});

module.exports = router;