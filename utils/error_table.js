
var errorTable = {
  // Common error codes.
  "BAD_LOGIN":            {"fwcErr": 1001, "msg": "Bad username or password"},
  "NOT_FOUND":            {"fwcErr": 1002, "msg": "Not found"},
  "ALREADY_EXISTS":       {"fwcErr": 1003, "msg": "Already exists"},
  "ALREADY_EXISTS_ID":    {"fwcErr": 1004, "msg": "Already exists with the same id"},
  "ALREADY_EXISTS_NAME":  {"fwcErr": 1005, "msg": "Already exists with the same name"},

  // Input validation error codes.
  "NOT_ACCEPTED_METHOD":  {"fwcErr": 2001, "msg": "HTTP method not accepted by FWCloud.net API"},
  "BODY_MUST_BE_EMPTY":   {"fwcErr": 2002, "msg": "Request body must be empty for GET method"},
  "BAD_API_CALL":         {"fwcErr": 2003, "msg": "Bad API call"},
  "BAD_API_DATA":         {"fwcErr": 2004, "msg": "Bad API call data"},
  "MODULE_NOT_FOUND":     {"fwcErr": 2005, "msg": "This Express route is not controlled in the input data validation process"},

  // Tree error codes.
  "BAD_TREE_NODE_TYPE":   {"fwcErr": 2001, "msg": "Bad tree node type"},
};

//Export the object
module.exports = errorTable;
