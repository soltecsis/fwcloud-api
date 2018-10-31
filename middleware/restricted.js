//create object
var restrictedCheck = {};
//Export the object
module.exports = restrictedCheck;

var api_resp = require('../utils/api_response');

restrictedCheck.fwcloud = (req, res, next) => {
  var sql = 'Select (SELECT count(*) FROM fwcloud_db.firewall where fwcloud=' + req.body.fwcloud + ') as CF, ' +
    ' (SELECT count(*) FROM fwcloud_db.cluster where fwcloud=' + req.body.fwcloud + ') as CC ';
  req.dbCon.query(sql, (error, row) => {
    if (error) return api_resp.getJson(null, api_resp.ACR_ERROR, 'Error', null, error, jsonResp => res.status(200).json(jsonResp));

    if (row && row.length > 0) {
      var cadRestricted = "";
      if (row[0].CF > 0) {
        cadRestricted = " FIREWALLS";
        if (row[0].CC > 0)
          cadRestricted = cadRestricted + " AND CLUSTERS";
      } else if (row[0].CC > 0)
        cadRestricted = "  CLUSTERS";

      if (cadRestricted !== "") {
        restricted = {"result": false, "msg": "Restricted", "restrictions": "CLOUD WITH RESTRICTIONS, CLOUD HAS " + cadRestricted};
        api_resp.getJson(restricted, api_resp.ACR_RESTRICTED, 'RESTRICTED', null, null, jsonResp => res.status(200).json(jsonResp));
      } else next();
    } else next();
  });
};
