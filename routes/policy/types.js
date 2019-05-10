var express = require('express');
var router = express.Router();
var Policy_typeModel = require('../../models/policy/policy_type');
const fwcError = require('../../utils/error_table');


/* Get all policy_types*/
router.get('', (req, res) => {
	Policy_typeModel.getPolicy_types((error, data) => {
    if (data && data.length > 0)
      res.status(200).json(data);
    else
			res.status(204).end();
	});
});



/* Get  policy_type by type */
router.get('/:type', function (req, res)
{
	var type = req.params.type;
	Policy_typeModel.getPolicy_type(type, function (error, data)
	{
    if (data && data.length > 0)
      res.status(200).json(data);
    else
			res.status(400).json(fwcError.NOT_FOUND);
	});
});

/* Get all policy_types by name */
router.get('/name/:name', function (req, res)
{
	var name = req.params.name;
	Policy_typeModel.getPolicy_typeName(name, function (error, data)
	{
    if (data && data.length > 0)
      res.status(200).json(data);
    else
			res.status(400).json(fwcError.NOT_FOUND);
	});
});


module.exports = router;