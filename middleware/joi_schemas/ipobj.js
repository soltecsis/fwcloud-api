var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('./shared');
 
schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    const item2 = req.url.split('/')[2];
    if (item2==='group')
    try {
      const item1 = req.url.split('/')[1];
      resolve (await require('./'+item1+'/'+item2).validate(req));
    } catch(error) { return reject(error) }

    var schema = Joi.object().keys({ fwcloud: sharedSch.id });

    if (req.method==='POST' || (req.method==='PUT' && req.url==='/ipobj')) {
      schema = Joi.object().keys({ 
        id: sharedSch.id,
        interface: sharedSch.id.allow(null),
        name: sharedSch.name,
        type: sharedSch.unsigned_byte,
        protocol: sharedSch.unsigned_byte,
        ip_version: Joi.number().integer().valid([4,6]),
        address: Joi.alternatives().when('ip_version', { is: 4, then: sharedSch.ipv4, otherwise: sharedSch.ipv6 }),
        netmask: Joi.alternatives().when('ip_version', { is: 4, then: sharedSch.ipv4.optional(), otherwise: sharedSch.ipv6.optional() }),
        diff_serv: Joi.number().port(),
        icmp_code: sharedSch.unsigned_byte,
        icmp_type: sharedSch.unsigned_byte,
        tcp_flags_mask: sharedSch.unsigned_byte,
        tcp_flags_settings: sharedSch.unsigned_byte,
        range_start: Joi.alternatives().when('ip_version', { is: 4, then: sharedSch.ipv4, otherwise: sharedSch.ipv6 }),
        range_end: Joi.alternatives().when('ip_version', { is: 4, then: sharedSch.ipv4, otherwise: sharedSch.ipv6 }),
        source_port_start: Joi.number().port(),
        source_port_end: Joi.number().port(),
        destination_port_start: Joi.number().port(),
        destination_port_end: Joi.number().port(),
        options: Joi.number().integer(),
        comment: sharedSch.comment.optional(),
      });
      if (req.method==='PUT') schema = schema.append({ id: sharedSch.id });
      else if (req.method==='POST') schema = schema.append({ node_parent: sharedSch.id, node_order: sharedSch.id, node_type: sharedSch.id });
    } 
    else if (req.method==='PUT') {
      if (req.url==='/ipobj/get')
        schema = schema.append({ id: sharedSch.id });
      if (req.url==='/ipobj/del' || req.url==='/ipobj/where' || req.url==='/ipobj/restricted')
        schema = schema.append({ id: sharedSch.id, type: sharedSch.id });
    } else return reject(new Error('Request method not accepted'));

    try {
      await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);

      // Semantic validation.
      if (req.body.source_port_start > source_port_end)
        throw(new Error('Source port end must be greater or equal than source port start'));
      if (req.body.destination_port_start > destination_port_end)
        throw(new Error('Destination port end must be greater or equal than destination port start'));

      resolve();
    } catch(error) { return reject(error) } 
  });
};
