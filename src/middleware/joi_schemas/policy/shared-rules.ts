import { Request } from 'express';

const Joi = require('joi');
const sharedSch = require('../shared');
const fwcError = require('../../../utils/error_table');

const nullableDate = Joi.date().allow(null).allow('').optional();
const nullableText = Joi.string().allow(null).allow('').max(65535).optional();
const nullableShortText = Joi.string().allow(null).allow('').max(255).optional();
const nullableDirection = Joi.number().integer().allow(null).optional();
const sharedRulePolicyType = Joi.number().integer().valid(1, 2, 3, 4, 5, 61, 62, 63, 64, 65);
const nullableRef = Joi.number().integer().allow(null).optional();
const sharedRuleIPObj = Joi.object()
  .keys({
    rule: sharedSch.id.optional(),
    ipobj: nullableRef,
    ipObj: nullableRef,
    ipObjId: nullableRef,
    ipobjId: nullableRef,
    ipobj_g: nullableRef,
    ipObjGroupId: nullableRef,
    ipobjGroupId: nullableRef,
    group: nullableRef,
    groupId: nullableRef,
    interface: nullableRef,
    interfaceId: nullableRef,
    id: nullableRef,
    obj_id: nullableRef,
    object_id: nullableRef,
    type: nullableRef,
    obj_type_id: nullableRef,
    object_type: nullableRef,
    position: sharedSch.id.optional(),
    rule_position_id: sharedSch.id.optional(),
    policyPositionId: sharedSch.id.optional(),
    position_order: nullableRef,
    order: nullableRef,
    node_order: nullableRef,
  })
  .unknown(true);
const sharedRuleInterface = Joi.object()
  .keys({
    rule: sharedSch.id.optional(),
    interface: nullableRef,
    interfaceId: nullableRef,
    id: nullableRef,
    obj_id: nullableRef,
    position: sharedSch.id.optional(),
    rule_position_id: sharedSch.id.optional(),
    policyPositionId: sharedSch.id.optional(),
    position_order: nullableRef,
    order: nullableRef,
    node_order: nullableRef,
  })
  .unknown(true);
const sharedRulePosition = Joi.object()
  .keys({
    id: sharedSch.id.optional(),
    position: sharedSch.id.optional(),
    policyPositionId: sharedSch.id.optional(),
    content: Joi.string().valid('I', 'O').optional(),
    ipobjs: Joi.array().items(sharedRuleIPObj).optional(),
    objects: Joi.array().items(sharedRuleIPObj).optional(),
    items: Joi.array().items(sharedRuleIPObj).optional(),
    interfaces: Joi.array().items(sharedRuleInterface).optional(),
  })
  .unknown(true);

const optionalRuleFields = {
  rule_order: sharedSch.id.optional(),
  direction: nullableDirection,
  action: sharedSch.rule_action.optional(),
  time_start: nullableDate,
  time_end: nullableDate,
  active: sharedSch._0_1.optional(),
  options: sharedSch.u16bits.optional(),
  comment: sharedSch.comment,
  type: sharedRulePolicyType.optional(),
  style: sharedSch.style.optional(),
  fw_apply_to: sharedSch.id.allow(null).optional(),
  negate: nullableShortText,
  mark: sharedSch.mark_id.allow(null).optional(),
  special: sharedSch.SpecialPolicyRule.optional(),
  run_before: nullableText,
  run_after: nullableText,
  ipobjs: Joi.array().items(sharedRuleIPObj).optional(),
  ipObjects: Joi.array().items(sharedRuleIPObj).optional(),
  ip_objects: Joi.array().items(sharedRuleIPObj).optional(),
  rule_ipobjs: Joi.array().items(sharedRuleIPObj).optional(),
  policy_r__ipobj: Joi.array().items(sharedRuleIPObj).optional(),
  shared_rule__ipobj: Joi.array().items(sharedRuleIPObj).optional(),
  interfaces: Joi.array().items(sharedRuleInterface).optional(),
  rule_interfaces: Joi.array().items(sharedRuleInterface).optional(),
  policy_r__interface: Joi.array().items(sharedRuleInterface).optional(),
  shared_rule__interface: Joi.array().items(sharedRuleInterface).optional(),
  positions: Joi.array().items(sharedRulePosition).optional(),
};

const schema = {
  validate: (req: Request): Promise<void> => {
    return new Promise(async (resolve, reject) => {
      let schema = Joi.object().keys({
        fwcloud: sharedSch.id,
      });

      if (req.method === 'POST') {
        if (req.url === '/policy/shared-rules') {
          schema = schema.append({
            name: sharedSch.name,
            policy_type: sharedRulePolicyType,
            comment: sharedSch.comment,
            style: sharedSch.style.optional(),
            active: sharedSch._0_1.optional(),
          });
        } else if (req.url === '/policy/shared-rules/apply') {
          schema = schema.append({
            firewall: sharedSch.id,
            shared_rule_set: sharedSch.id,
            type: sharedRulePolicyType,
            rule_order: sharedSch.id.optional(),
            active: sharedSch._0_1.optional(),
            style: sharedSch.style.optional(),
          });
        } else if (req.url === '/policy/shared-rules/rule') {
          schema = schema.append({
            shared_rule_set: sharedSch.id,
            ...optionalRuleFields,
            action: sharedSch.rule_action,
          });
        } else {
          return reject(fwcError.BAD_API_CALL);
        }
      } else if (req.method === 'PUT') {
        if (req.url === '/policy/shared-rules/get') {
          schema = schema.append({
            shared_rule_set: sharedSch.id.optional(),
            policy_type: sharedRulePolicyType.optional(),
          });
        } else if (req.url === '/policy/shared-rules') {
          schema = schema.append({
            shared_rule_set: sharedSch.id,
            name: sharedSch.name.optional(),
            policy_type: sharedRulePolicyType.optional(),
            comment: sharedSch.comment,
            style: sharedSch.style.optional(),
            active: sharedSch._0_1.optional(),
          });
        } else if (req.url === '/policy/shared-rules/del') {
          schema = schema.append({
            shared_rule_set: sharedSch.id,
          });
        } else if (req.url === '/policy/shared-rules/applications/get') {
          schema = schema.append({
            shared_rule_set: sharedSch.id.optional(),
            firewall: sharedSch.id.optional(),
            type: sharedRulePolicyType.optional(),
          });
        } else if (req.url === '/policy/shared-rules/apply') {
          schema = schema.append({
            policyApplyId: sharedSch.id,
            rule_order: sharedSch.id.optional(),
            active: sharedSch._0_1.optional(),
            style: sharedSch.style.optional(),
          });
        } else if (req.url === '/policy/shared-rules/unapply') {
          schema = schema.append({
            policyApplyId: sharedSch.id,
          });
        } else if (req.url === '/policy/shared-rules/rules/get') {
          schema = schema.append({
            shared_rule_set: sharedSch.id,
          });
        } else if (req.url === '/policy/shared-rules/rule') {
          schema = schema.append({
            shared_rule_set: sharedSch.id,
            rule: sharedSch.id,
            ...optionalRuleFields,
          });
        } else if (req.url === '/policy/shared-rules/rule/del') {
          schema = schema.append({
            shared_rule_set: sharedSch.id,
            rulesIds: Joi.array().items(sharedSch.id),
          });
        } else {
          return reject(fwcError.BAD_API_CALL);
        }
      } else {
        return reject(fwcError.BAD_API_CALL);
      }

      try {
        await schema.validateAsync(req.body, sharedSch.joiValidationOptions);
        resolve();
      } catch (error) {
        return reject(error);
      }
    });
  },
};

export = schema;
