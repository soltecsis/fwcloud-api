
var errorTable = {
  "NOT_ACCEPTED_METHOD":  {"fwcErr": 50001, "msg": "HTTP method not accepted by FWCloud.net API"},
  "BODY_MUST_BE_EMPTY":   {"fwcErr": 50002, "msg": "Request body must be empty for GET method"},
  "BAD_API_CALL":         {"fwcErr": 50003, "msg": "Bad API call"},
  "BAD_API_DATA":         {"fwcErr": 50004, "msg": "Bad API call data"},
  "MODULE_NOT_FOUND":     {"fwcErr": 50005, "msg": "This Express route is not controlled in the input data validation process"},
  "BAD_LOGIN":            {"fwcErr": 50006, "msg": "Bad username or password"},
  "NOT_FOUND":            {"fwcErr": 50007, "msg": "Not found"},
  "ALREADY_EXISTS":       {"fwcErr": 50008, "msg": "Already exists"},
};

//Export the object
module.exports = errorTable;
