//create object
var inputValidation = {};
//Export the object
module.exports = inputValidation;

const api_resp = require('../utils/api_response');

inputValidation.check = async (req, res, next) => {
  // URLs excluded of the input data validation process because don't have any data to be validated.
  if ((req.method==='GET' && req.url==='/fwclouds') 
      || (req.method==='GET' && req.url==='/ipobj-types')
      || (req.method==='GET' && req.url==='/policy-types'))
    return next();

  try {
    const item1 = req.url.split('/')[1];
    await require('./joi_schemas/'+item1).validate(req);

    // If we arrive here then input data has been sucessfully validated.  
    next();
  } catch(error) { 
    if (error instanceof Error && error.code === "MODULE_NOT_FOUND")
      api_resp.getJson(null, api_resp.ACR_ERROR, 'This Express route is not controlled in the input data validation process', 'INPUT VALIDATION', error, jsonResp => res.status(200).json(jsonResp));
    else
      api_resp.getJson(null, api_resp.ACR_DATA_ERROR, 'Bad input data', 'INPUT VALIDATION', error, jsonResp => res.status(200).json(jsonResp)) 
  }
};

