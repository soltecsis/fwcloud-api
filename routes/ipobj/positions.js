var express = require('express');
var router = express.Router();
var Ipobj_type__policy_positionModel = require('../../models/ipobj/ipobj_type__policy_position');
const fwcError = require('../../utils/error_table');

/* Get all ipobj_type__policy_positions*/
router.get('/policy', (req, res) => {
	Ipobj_type__policy_positionModel.getIpobj_type__policy_positions((error, data) => {
    if (data && data.length > 0)
      res.status(200).json(data);
    else
			res.status(400).json(fwcError.NOT_FOUND);
	});
});

module.exports = router;