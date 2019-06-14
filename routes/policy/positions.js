var express = require('express');
var router = express.Router();
var policyPositionModel = require('../../models/policy/position');
const fwcError = require('../../utils/error_table');

/* Get all policy_positions by Type*/
router.put('/get', async(req, res) => {
    try {
        const data = await policyPositionModel.getPolicyPositionsByType(req.dbCon, req.body.type);
        //If exists policy_position get data
        if (data && data.length > 0)
            res.status(200).json(data);
        else
            res.status(400).json(fwcError.NOT_FOUND);
    } catch (error) { res.status(400).json(error) }
});

module.exports = router;