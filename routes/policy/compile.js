/**
 * Module to routing COMPILE requests
 * <br>BASE ROUTE CALL: <b>/policy/compile</b>
 *
 * @module Compile
 * 
 * @requires express
 * @requires Policy_rModel
 * 
 */


/**
 * Clase to manage Compile Policy
 *
 * @class CompileRouter
 */


/**
 * Property  to manage express
 *
 * @property express
 * @type express
 */
var express = require('express');
/**
 * Property  to manage  route
 *
 * @property router
 * @type express.Router 
 */
var router = express.Router();
/**
 * Property Model to manage Policy Data
 *
 * @property PolicyModel
 * @type /models/policy_r
 */
var Policy_rModel = require('../../models/policy_r');

/**
 * Property Logger to manage App logs
 *
 * @property logger
 * @type log4js/app
 *
 */
var logger = require('log4js').getLogger("compiler");

/**
 * Property Model to manage API RESPONSE data
 *
 * @property api_resp
 * @type /models/api_response
 * 
 */
var api_resp = require('../../utils/api_response');

const POLICY_TYPE_INPUT = 1;
const POLICY_TYPE_OUTPUT = 2;
const POLICY_TYPE_FORWARD = 3;
const POLICY_TYPE = [ '', 'INPUT', 'OUTPUT', 'FORWARD'];
const ACTION = [ '', 'ACCEPT', 'DENY', 'REJECT', 'CONTINUE'];

/*----------------------------------------------------------------------------------------------------------------------*/
function pre_compile_sd(dir,sd) {
  var items = [];

  for(var i=0; i<sd.length; i++) {
    if (sd[i].type===5) // Host
      items.push(dir+sd[i].address);
    else if (sd[i].type===7) // Network
      items.push(dir+sd[i].address+"/"+sd[i].netmask);
  }

  return items;
}
/*----------------------------------------------------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------------------------------------------------*/
function pre_compile_if(dir,ifs) {
  var items = [];

  for(var i=0; i<ifs.length; i++)
    items.push(dir+ifs[i].name);

  return items;
}
/*----------------------------------------------------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------------------------------------------------*/
// Agrupate services position by protocol number (TCP, UDP, ICMP, etc.) 
// Returns an array of strings with the services agrupated by protocol.
/*----------------------------------------------------------------------------------------------------------------------*/
function pre_compile_svc(svc) {
  var items = [];
  var tcp = "";
  var udp = "";
  var icmp = "";
  var tmp = "";

  for(var i=0; i<svc.length; i++) {
    switch (svc[i].protocol) {
      case 6: // TCP
        if (svc[i].source_port_end===0) { // No source port.
          if (tcp) tcp+=",";
          tcp += (svc[i].destination_port_start === svc[i].destination_port_end) ? svc[i].destination_port_start : (svc[i].destination_port_start+":"+svc[i].destination_port_end);
        }
        else {
          tmp = "-p tcp --sport " + ((svc[i].source_port_start === svc[i].source_port_end) ? svc[i].source_port_start : (svc[i].source_port_start+":"+svc[i].source_port_end));
          if (svc[i].destination_port_end!=0)
            tmp += " --dport " + ((svc[i].destination_port_start === svc[i].destination_port_end) ? svc[i].destination_port_start : (svc[i].destination_port_start+":"+svc[i].destination_port_end));
          items.push(tmp);
        }
      break;
       
      case 17: // UDP
        if (svc[i].source_port_end===0) { // No source port.
          if (udp) udp+=",";
          udp += (svc[i].destination_port_start === svc[i].destination_port_end) ? svc[i].destination_port_start : (svc[i].destination_port_start+":"+svc[i].destination_port_end);
        }
        else {
          tmp = "-p udp --sport " + ((svc[i].source_port_start === svc[i].source_port_end) ? svc[i].source_port_start : (svc[i].source_port_start+":"+svc[i].source_port_end));
          if (svc[i].destination_port_end!=0)
            tmp += " --dport " + ((svc[i].destination_port_start === svc[i].destination_port_end) ? svc[i].destination_port_start : (svc[i].destination_port_start+":"+svc[i].destination_port_end)); 
          items.push(tmp);
        }
      break;
  
      default:
      break;
    }
  }

  if (tcp) {
    tcp = (tcp.indexOf(",") > -1) ? ("-p tcp -m multiport --dports "+tcp) : ("-p tcp --dport "+tcp);
    items.push(tcp);
  } 
  if (udp) {
    udp = (udp.indexOf(",") > -1) ? ("-p udp -m multiport --dports "+udp) : ("-p udp --dport "+udp);
    items.push(udp);
  }
    
  return items;
}

/*----------------------------------------------------------------------------------------------------------------------*/
// This function will return an array of arrays of strings. 
// Each array will contain the precompiled strings for the items of each rule position.
/*----------------------------------------------------------------------------------------------------------------------*/
function pre_compile(data) {
  var position_items = [];
  
  const policy_type = data[0].type;
  
  // Generate items strings for all the rule positions.
  // WARNING: The orde of creation of the arrays is important for optimization!!!!
  // The positions first in the array will be used first in the conditions.
  const if1_items = pre_compile_if(((policy_type===POLICY_TYPE_OUTPUT) ? "-o " : "-i "),data[0].positions[3].ipobjs);
  if (if1_items.length>0) position_items.push(if1_items);
  
  if (policy_type === POLICY_TYPE_FORWARD) {
    const if2_items = pre_compile_if("-o ",data[0].positions[4].ipobjs);
    if (if2_items.length>0) position_items.push(if2_items);
  }

  const svc_items = pre_compile_svc(data[0].positions[2].ipobjs);
  if (svc_items.length>0) position_items.push(svc_items);
  
  const src_items = pre_compile_sd("-s ",data[0].positions[0].ipobjs);
  if (src_items.length>0) position_items.push(src_items);
  
  const dst_items = pre_compile_sd("-d ",data[0].positions[1].ipobjs);
  if (dst_items.length>0) position_items.push(dst_items);
  

  // Order the resulting array by number of strings into each array.
  if (position_items.length<2) // Don't need ordering.
    return position_items;

  for(var i=0; i<position_items.length; i++) {
    for(var p=i,j=i+1; j<position_items.length; j++) {
      if (position_items[j].length < position_items[p].length)
        p=j;
    }
    tmp = position_items[i];
    position_items[i] = position_items[p];
    position_items[p] = tmp;
  }

  return position_items;
}
/*----------------------------------------------------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------------------------------------------------*/
/* Get  policy_r by id and  by Id */
/*----------------------------------------------------------------------------------------------------------------------*/
router.get('/:user/:cloud/:fw/:type/:rule', (req, res) => {
  var user = req.params.user;
  var cloud = req.params.cloud;
  var fw = req.params.fw;
  var type = req.params.type;
  var rule = req.params.rule;

  Policy_rModel.getPolicy_rs_type(cloud,fw,type,rule, (error, data) => {
    // If all goes fine.
    //res.status(220).json({data});

    if (!data) {
      res.status(404).json({"msg": "Rule data not found."});
      return;
    }
		
		const policy_type = data[0].type;
		if (!policy_type || (policy_type!==POLICY_TYPE_INPUT && policy_type!==POLICY_TYPE_OUTPUT && policy_type!==POLICY_TYPE_FORWARD)) {
      res.status(404).json({"msg": "Invalid policy type."});
      return;
		}

		const action = ACTION[data[0].action];

    // Verify that recevied data is correct.
    if (data.length!=1 || !(data[0].positions)
        || !(data[0].positions[0].ipobjs) || !(data[0].positions[1].ipobjs) || !(data[0].positions[2].ipobjs)
        || (policy_type===POLICY_TYPE_FORWARD && !(data[0].positions[3].ipobjs))) {
        res.status(404).json({"msg": "Bad rule data."});
      return;
    }

    const position_items = pre_compile(data);

    // Compile string.
    var cs="$IPTABLES -A " + POLICY_TYPE[policy_type] + " ";
    var cs_trail = "-m state --state NEW -j " + action + "\r\n";

    // Rule compilation process.
    if (position_items.length===0) // No conditions rule.
      cs += cs_trail;
    else if (position_items.length===1) { // One condition rule.
      if (position_items[0].length===1) // Only one item in the condition.
        cs += position_items[0][0] + " " + cs_trail;
      else { // Multiple items in the condition.
        var cs1 = cs;
        cs = "";
        for(var i=0; i<position_items[0].length; i++)
          cs += cs1 + position_items[0][i] + " " + cs_trail;
      }
    }
    else { // Multiple condition rules.
      for(var i=0,j,chain_number=1,chain_name="",chain_next=""; i<position_items.length; i++) {
        // We have the position_items array ordered by arrays length.
        if (position_items[i].length===1)
          cs += position_items[i][0] + " ";
        else {
          chain_name = "FWCRULE" + rule + ".CH" + chain_number;

          // If we are in the first condition.
          if (i===0) {
            var cs1 = cs;
            cs = "";
            for(var j=0; j<position_items[0].length; j++)
              cs += cs1 + position_items[0][j] + ((j<(position_items[0].length-1)) ? " -m state --state NEW -j "+chain_name+"\r\n" : " ");
          }
          else {
            // If we are at the end of the array, the next chain will be the rule action.
            chain_next = (i===((position_items.length)-1)) ? action : "FWCRULE" + rule + ".CH" + (chain_number+1);

            cs = "$IPTABLES -N " + chain_name + "\r\n" + cs + ((chain_number===1) ? "-m state --state NEW -j " + chain_name + "\r\n" : "");
            for(j=0; j<position_items[i].length; j++) {
              cs += "$IPTABLES -A " + chain_name + " " + position_items[i][j] + " -j " + chain_next + "\r\n";
            }
            chain_number++;            
          }
        }
      }
      
      // If we have not used IPTABLES user defined chains.
      if (chain_number===1)
        cs += cs_trail;
    }

    // End of compilation process.
    cs = "echo \"Rule ID: " + rule + "\"\r\n" + cs;
    res.status(220).send(cs);
  });
});
/*----------------------------------------------------------------------------------------------------------------------*/

module.exports = router;

