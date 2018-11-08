var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('./shared');

schema.validate = req => {
    return new Promise(async(resolve, reject) => {
        const item2 = req.url.split('/')[2];
        if (item2 === 'group' || item2 === 'types') {
            try {
                const item1 = req.url.split('/')[1];
                resolve(await require('./' + item1 + '/' + item2).validate(req));
            } catch (error) { return reject(error) }
        }

        var schema = Joi.object().keys({ fwcloud: sharedSch.id });

        /*
          The only common fields of all the IP object types are:
            - id (ONLY for updating requests -PUT-)
            - name
            - comment
          All the rest must be optional.
        */
        if (req.method === 'POST' || (req.method === 'PUT' && req.url === '/ipobj')) {
            schema = Joi.object().keys({
                interface: sharedSch.id.allow(null).optional(),
                name: sharedSch.name,
                type: sharedSch.u8bits.optional(),
                protocol: sharedSch.u8bits.optional(),
                ip_version: Joi.number().integer().valid([4, 6]).optional(),
                address: Joi.alternatives().when('ip_version', { is: 4, then: sharedSch.ipv4, otherwise: sharedSch.ipv6 }).optional(),
                netmask: Joi.alternatives().when('ip_version', { is: 4, then: sharedSch.ipv4, otherwise: sharedSch.ipv6 }).optional(),
                diff_serv: Joi.number().port().optional(),
                icmp_code: sharedSch.u8bits.optional(),
                icmp_type: sharedSch.u8bits.optional(),
                tcp_flags_mask: sharedSch.u8bits.optional(),
                tcp_flags_settings: sharedSch.u8bits.optional(),
                range_start: Joi.alternatives().when('ip_version', { is: 4, then: sharedSch.ipv4, otherwise: sharedSch.ipv6 }).optional(),
                range_end: Joi.alternatives().when('ip_version', { is: 4, then: sharedSch.ipv4, otherwise: sharedSch.ipv6 }).optional(),
                source_port_start: Joi.number().port().optional(),
                source_port_end: Joi.number().port().optional(),
                destination_port_start: Joi.number().port().optional(),
                destination_port_end: Joi.number().port().optional(),
                options: Joi.number().integer().optional(),
                comment: sharedSch.comment,
            });
            if (req.method === 'PUT') schema = schema.append({ id: sharedSch.id });
            else if (req.method === 'POST') schema = schema.append({ node_parent: sharedSch.id, node_order: sharedSch.id, node_type: sharedSch.name }); // node_type is an string
        } else if (req.method === 'PUT') {
            if (req.url === '/ipobj/get')
                schema = schema.append({ id: sharedSch.id });
            else if (req.url === '/ipobj/del' || req.url === '/ipobj/where' || req.url === '/ipobj/restricted')
                schema = schema.append({ id: sharedSch.id, type: sharedSch.id });
        } else return reject(new Error('Request method not accepted'));

        try {
            await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);

            // Semantic validation.
            if (req.method === 'POST' || (req.method === 'PUT' && req.url === '/ipobj')) {
                if (req.body.source_port_start > req.body.source_port_end)
                    throw (new Error('Source port end must be greater or equal than source port start'));
                if (req.body.destination_port_start > req.body.destination_port_end)
                    throw (new Error('Destination port end must be greater or equal than destination port start'));
            }

            resolve();
        } catch (error) { return reject(error) }
    });
};