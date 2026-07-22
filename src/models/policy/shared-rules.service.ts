import { AbstractApplication } from '../../fonaments/abstract-application';
import db from '../../database/database-manager';
import { Service } from '../../fonaments/services/service';
import {
  assertSharedRuleSetApplicationsInterfacesAreCompatible,
  assertSharedRuleSetInterfacesAreCompatible,
} from './shared-rule-helpers';

const fwcError = require('../../utils/error_table');

const SHARED_RULES_FOLDER_NODE_TYPE = 'SRF';
const SHARED_RULE_SET_NODE_TYPE = 'SRS';
const SHARED_RULES_FOLDER_NAME = 'Shared Rules';
const SHARED_RULE_POLICY_TREE = {
  1: {
    parentName: 'IPv4 POLICY',
    parentNodeType: 'SRP4',
    parentOrder: 1,
    name: 'INPUT',
    nodeType: 'SRI',
    order: 1,
  },
  2: {
    parentName: 'IPv4 POLICY',
    parentNodeType: 'SRP4',
    parentOrder: 1,
    name: 'OUTPUT',
    nodeType: 'SRO',
    order: 2,
  },
  3: {
    parentName: 'IPv4 POLICY',
    parentNodeType: 'SRP4',
    parentOrder: 1,
    name: 'FORWARD',
    nodeType: 'SRFW',
    order: 3,
  },
  4: {
    parentName: 'IPv4 POLICY',
    parentNodeType: 'SRP4',
    parentOrder: 1,
    name: 'SNAT',
    nodeType: 'SRSN',
    order: 4,
  },
  5: {
    parentName: 'IPv4 POLICY',
    parentNodeType: 'SRP4',
    parentOrder: 1,
    name: 'DNAT',
    nodeType: 'SRDN',
    order: 5,
  },
  61: {
    parentName: 'IPv6 POLICY',
    parentNodeType: 'SRP6',
    parentOrder: 2,
    name: 'INPUT',
    nodeType: 'SRI6',
    order: 1,
  },
  62: {
    parentName: 'IPv6 POLICY',
    parentNodeType: 'SRP6',
    parentOrder: 2,
    name: 'OUTPUT',
    nodeType: 'SRO6',
    order: 2,
  },
  63: {
    parentName: 'IPv6 POLICY',
    parentNodeType: 'SRP6',
    parentOrder: 2,
    name: 'FORWARD',
    nodeType: 'SRFW6',
    order: 3,
  },
  64: {
    parentName: 'IPv6 POLICY',
    parentNodeType: 'SRP6',
    parentOrder: 2,
    name: 'SNAT',
    nodeType: 'SRSN6',
    order: 4,
  },
  65: {
    parentName: 'IPv6 POLICY',
    parentNodeType: 'SRP6',
    parentOrder: 2,
    name: 'DNAT',
    nodeType: 'SRDN6',
    order: 5,
  },
};
const SHARED_RULE_POLICY_TYPES = Object.keys(SHARED_RULE_POLICY_TREE).map((type) => Number(type));
const SHARED_RULE_POLICY_TYPE_BY_NODE_TYPE = Object.entries(SHARED_RULE_POLICY_TREE).reduce(
  (map, [type, policyTree]) => {
    map[policyTree.nodeType] = Number(type);
    return map;
  },
  {},
);
const MARK_ALLOWED_POLICY_TYPES = [1, 2, 3, 61, 62, 63];

const hasOwn = (data, field) => Object.prototype.hasOwnProperty.call(data, field);
const hasValue = (value) => value !== undefined && value !== null && value !== '';
const nullIfUndefined = (value) => (value === undefined ? null : value);
const nullIfZero = (value) => (value === 0 ? null : nullIfUndefined(value));
const isPositiveId = (value) => Number(value) > 0;
const isDuplicateEntryError = (error) =>
  error?.code === 'ER_DUP_ENTRY' ||
  Number(error?.errno) === 1062 ||
  error?.driverError?.code === 'ER_DUP_ENTRY' ||
  Number(error?.driverError?.errno) === 1062;

const withTransaction = async (callback) => {
  const queryRunner = db.getSource().createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const result = await callback(queryRunner);
    await queryRunner.commitTransaction();
    return result;
  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
};

const getSharedRuleSet = async (queryRunner, fwcloud, sharedRuleSet) => {
  const rows = await queryRunner.query(
    `SELECT *
     FROM shared_rule_set
     WHERE id=? AND fwcloud=?`,
    [sharedRuleSet, fwcloud],
  );

  if (rows.length !== 1) {
    throw fwcError.NOT_FOUND;
  }

  return rows[0];
};

const getSharedRule = async (queryRunner, fwcloud, sharedRuleSet, rule) => {
  const rows = await queryRunner.query(
    `SELECT R.*, S.fwcloud
     FROM shared_rule R
     INNER JOIN shared_rule_set S ON S.id=R.shared_rule_set
     WHERE R.id=? AND R.shared_rule_set=? AND S.fwcloud=?`,
    [rule, sharedRuleSet, fwcloud],
  );

  if (rows.length !== 1) {
    throw fwcError.NOT_FOUND;
  }

  return rows[0];
};

const ensureFirewallInFwcloud = async (queryRunner, fwcloud, firewall) => {
  const rows = await queryRunner.query(`SELECT id FROM firewall WHERE id=? AND fwcloud=?`, [
    firewall,
    fwcloud,
  ]);

  if (rows.length !== 1) {
    throw fwcError.NOT_FOUND;
  }
};

const getSharedRulesFolderNodeId = async (queryRunner, fwcloud) => {
  const folderRows = await queryRunner.query(
    `SELECT id
     FROM fwc_tree
     WHERE fwcloud=? AND node_type=?
     ORDER BY id
     LIMIT 1`,
    [fwcloud, SHARED_RULES_FOLDER_NODE_TYPE],
  );

  if (folderRows.length > 0) {
    return folderRows[0].id;
  }

  const objectsRows = await queryRunner.query(
    `SELECT id
     FROM fwc_tree
     WHERE fwcloud=? AND node_type='FDO' AND id_parent IS NULL
     LIMIT 1`,
    [fwcloud],
  );

  if (objectsRows.length !== 1) {
    throw fwcError.NOT_FOUND;
  }

  const insertResult = await queryRunner.query(
    `INSERT INTO fwc_tree (name, id_parent, node_order, node_type, id_obj, obj_type, fwcloud)
     VALUES (?, ?, 0, ?, NULL, NULL, ?)`,
    [SHARED_RULES_FOLDER_NAME, objectsRows[0].id, SHARED_RULES_FOLDER_NODE_TYPE, fwcloud],
  );

  return insertResult.insertId;
};

const getSharedRulesPolicyTypeNodeId = async (queryRunner, fwcloud, policyType) => {
  const policyTree = SHARED_RULE_POLICY_TREE[Number(policyType)];

  if (!policyTree) {
    throw fwcError.NOT_ALLOWED;
  }

  const folderNodeId = await getSharedRulesFolderNodeId(queryRunner, fwcloud);

  const parentNodeRows = await queryRunner.query(
    `SELECT id
     FROM fwc_tree
     WHERE fwcloud=? AND id_parent=? AND node_type=?
     ORDER BY id
     LIMIT 1`,
    [fwcloud, folderNodeId, policyTree.parentNodeType],
  );

  let parentNodeId;
  if (parentNodeRows.length > 0) {
    parentNodeId = parentNodeRows[0].id;
  } else {
    const insertParentResult = await queryRunner.query(
      `INSERT INTO fwc_tree (name, id_parent, node_order, node_type, id_obj, obj_type, fwcloud)
       VALUES (?, ?, ?, ?, NULL, NULL, ?)`,
      [
        policyTree.parentName,
        folderNodeId,
        policyTree.parentOrder,
        policyTree.parentNodeType,
        fwcloud,
      ],
    );
    parentNodeId = insertParentResult.insertId;
  }

  const typeNodeRows = await queryRunner.query(
    `SELECT id
     FROM fwc_tree
     WHERE fwcloud=? AND id_parent=? AND node_type=? AND id_obj=?
     ORDER BY id
     LIMIT 1`,
    [fwcloud, parentNodeId, policyTree.nodeType, policyType],
  );

  if (typeNodeRows.length > 0) {
    return typeNodeRows[0].id;
  }

  const insertResult = await queryRunner.query(
    `INSERT INTO fwc_tree (name, id_parent, node_order, node_type, id_obj, obj_type, fwcloud)
     VALUES (?, ?, ?, ?, ?, NULL, ?)`,
    [policyTree.name, parentNodeId, policyTree.order, policyTree.nodeType, policyType, fwcloud],
  );

  return insertResult.insertId;
};

const createSharedRuleSetTreeNode = async (
  queryRunner,
  fwcloud,
  sharedRuleSet,
  name,
  policyType,
) => {
  const typeNodeId = await getSharedRulesPolicyTypeNodeId(queryRunner, fwcloud, policyType);

  const existingRows = await queryRunner.query(
    `SELECT id
     FROM fwc_tree
     WHERE fwcloud=? AND node_type=? AND id_obj=?
     LIMIT 1`,
    [fwcloud, SHARED_RULE_SET_NODE_TYPE, sharedRuleSet],
  );

  if (existingRows.length > 0) {
    return existingRows[0].id;
  }

  const insertResult = await queryRunner.query(
    `INSERT INTO fwc_tree (name, id_parent, node_order, node_type, id_obj, obj_type, fwcloud)
     VALUES (?, ?, 0, ?, ?, NULL, ?)`,
    [name, typeNodeId, SHARED_RULE_SET_NODE_TYPE, sharedRuleSet, fwcloud],
  );

  return insertResult.insertId;
};

const moveSharedRuleSetTreeNode = async (queryRunner, fwcloud, sharedRuleSet, name, policyType) => {
  const typeNodeId = await getSharedRulesPolicyTypeNodeId(queryRunner, fwcloud, policyType);
  await createSharedRuleSetTreeNode(queryRunner, fwcloud, sharedRuleSet, name, policyType);

  await queryRunner.query(
    `UPDATE fwc_tree
     SET id_parent=?, name=?
     WHERE fwcloud=? AND node_type=? AND id_obj=?`,
    [typeNodeId, name, fwcloud, SHARED_RULE_SET_NODE_TYPE, sharedRuleSet],
  );
};

const deleteSharedRuleSetTreeNode = async (queryRunner, fwcloud, sharedRuleSet) => {
  await queryRunner.query(
    `DELETE FROM fwc_tree
     WHERE fwcloud=? AND node_type=? AND id_obj=?`,
    [fwcloud, SHARED_RULE_SET_NODE_TYPE, sharedRuleSet],
  );
};

const disableAppliedFirewallsCompileStatus = async (queryRunner, fwcloud, sharedRuleSet) => {
  await queryRunner.query(
    `UPDATE firewall F
     INNER JOIN policy_r__shared_rule_set A ON A.firewall=F.id
     SET F.status=F.status|3
     WHERE F.fwcloud=? AND A.shared_rule_set=?`,
    [fwcloud, sharedRuleSet],
  );
};

const disableFirewallCompileStatus = async (queryRunner, fwcloud, firewall) => {
  await queryRunner.query(`UPDATE firewall SET status=status|3 WHERE id=? AND fwcloud=?`, [
    firewall,
    fwcloud,
  ]);
};

const validatePolicyType = (sharedRuleSet, type) => {
  if (SHARED_RULE_POLICY_TYPES.indexOf(Number(type)) === -1) {
    throw fwcError.SHARED_RULE_POLICY_TYPE_NOT_SUPPORTED;
  }

  if (Number(sharedRuleSet.policy_type) !== Number(type)) {
    throw fwcError.SHARED_RULE_POLICY_TYPE_MISMATCH;
  }
};

const policyTypeFromNodeType = (nodeType) => {
  const policyType = SHARED_RULE_POLICY_TYPE_BY_NODE_TYPE[nodeType];

  if (!policyType) {
    throw fwcError.NOT_ALLOWED;
  }

  return policyType;
};

const resolveApplyPolicyType = (body) => {
  let type = hasValue(body.type) ? Number(body.type) : null;

  if (hasValue(body.node_type)) {
    const nodeTypePolicyType = policyTypeFromNodeType(body.node_type);

    if (type !== null && type !== nodeTypePolicyType) {
      throw fwcError.SHARED_RULE_POLICY_TYPE_MISMATCH;
    }

    type = nodeTypePolicyType;
  }

  if (type === null) {
    throw fwcError.NOT_ALLOWED;
  }

  return type;
};

const validateMark = (mark, type) => {
  if (mark && MARK_ALLOWED_POLICY_TYPES.indexOf(Number(type)) === -1) {
    throw fwcError.SHARED_RULE_MARK_NOT_ALLOWED;
  }
};

const assertSharedRuleSetIsNotApplied = async (queryRunner, firewall, type, sharedRuleSet) => {
  const applications = await queryRunner.query(
    `SELECT id
     FROM policy_r__shared_rule_set
     WHERE firewall=? AND type=? AND shared_rule_set=?
     LIMIT 1`,
    [firewall, type, sharedRuleSet],
  );

  if (applications.length > 0) {
    throw fwcError.SHARED_RULE_SET_ALREADY_APPLIED;
  }
};

const getNextSharedRuleOrder = async (queryRunner, sharedRuleSet) => {
  const rows = await queryRunner.query(
    `SELECT COALESCE(MAX(rule_order), 0) + 1 AS next_order
     FROM shared_rule
     WHERE shared_rule_set=?`,
    [sharedRuleSet],
  );

  return Number(rows[0].next_order);
};

const compactSharedRuleOrders = async (queryRunner, sharedRuleSet) => {
  const rows = await queryRunner.query(
    `SELECT id
     FROM shared_rule
     WHERE shared_rule_set=?
     ORDER BY rule_order, id`,
    [sharedRuleSet],
  );

  for (let i = 0; i < rows.length; i++) {
    await queryRunner.query(`UPDATE shared_rule SET rule_order=? WHERE id=?`, [i + 1, rows[i].id]);
  }
};

const moveSharedRuleOrder = async (queryRunner, sharedRuleSet, rule, currentOrder, nextOrder) => {
  if (Number(currentOrder) === Number(nextOrder)) {
    return;
  }

  if (Number(nextOrder) > Number(currentOrder)) {
    await queryRunner.query(
      `UPDATE shared_rule
       SET rule_order=rule_order-1
       WHERE shared_rule_set=? AND id<>? AND rule_order>? AND rule_order<=?`,
      [sharedRuleSet, rule, currentOrder, nextOrder],
    );
  } else {
    await queryRunner.query(
      `UPDATE shared_rule
       SET rule_order=rule_order+1
       WHERE shared_rule_set=? AND id<>? AND rule_order>=? AND rule_order<?`,
      [sharedRuleSet, rule, nextOrder, currentOrder],
    );
  }
};

const getNextPolicyOrder = async (queryRunner, firewall, type) => {
  const rows = await queryRunner.query(
    `SELECT COALESCE(MAX(rule_order), 0) + 1 AS next_order
     FROM (
       SELECT rule_order FROM policy_r WHERE firewall=? AND type=?
       UNION ALL
       SELECT rule_order FROM policy_r__shared_rule_set WHERE firewall=? AND type=?
     ) policy_orders`,
    [firewall, type, firewall, type],
  );

  return Number(rows[0].next_order);
};

const reorderPolicyAfterRuleOrder = async (queryRunner, firewall, type, ruleOrder) => {
  await queryRunner.query(
    `UPDATE policy_r
     SET rule_order=rule_order+1
     WHERE firewall=? AND type=? AND rule_order>=?`,
    [firewall, type, ruleOrder],
  );
  await queryRunner.query(
    `UPDATE policy_r__shared_rule_set
     SET rule_order=rule_order+1
     WHERE firewall=? AND type=? AND rule_order>=?`,
    [firewall, type, ruleOrder],
  );
};

const compactPolicyOrdersAfterDelete = async (queryRunner, firewall, type, deletedOrder) => {
  await queryRunner.query(
    `UPDATE policy_r
     SET rule_order=rule_order-1
     WHERE firewall=? AND type=? AND rule_order>?`,
    [firewall, type, deletedOrder],
  );
  await queryRunner.query(
    `UPDATE policy_r__shared_rule_set
     SET rule_order=rule_order-1
     WHERE firewall=? AND type=? AND rule_order>?`,
    [firewall, type, deletedOrder],
  );
};

const movePolicyApplyOrder = async (
  queryRunner,
  firewall,
  type,
  policyApplyId,
  currentOrder,
  nextOrder,
) => {
  if (Number(currentOrder) === Number(nextOrder)) {
    return;
  }

  if (Number(nextOrder) > Number(currentOrder)) {
    await queryRunner.query(
      `UPDATE policy_r
       SET rule_order=rule_order-1
       WHERE firewall=? AND type=? AND rule_order>? AND rule_order<=?`,
      [firewall, type, currentOrder, nextOrder],
    );
    await queryRunner.query(
      `UPDATE policy_r__shared_rule_set
       SET rule_order=rule_order-1
       WHERE firewall=? AND type=? AND id<>? AND rule_order>? AND rule_order<=?`,
      [firewall, type, policyApplyId, currentOrder, nextOrder],
    );
  } else {
    await queryRunner.query(
      `UPDATE policy_r
       SET rule_order=rule_order+1
       WHERE firewall=? AND type=? AND rule_order>=? AND rule_order<?`,
      [firewall, type, nextOrder, currentOrder],
    );
    await queryRunner.query(
      `UPDATE policy_r__shared_rule_set
       SET rule_order=rule_order+1
       WHERE firewall=? AND type=? AND id<>? AND rule_order>=? AND rule_order<?`,
      [firewall, type, policyApplyId, nextOrder, currentOrder],
    );
  }
};

const getPolicyApply = async (queryRunner, fwcloud, policyApplyId) => {
  const rows = await queryRunner.query(
    `SELECT A.*
     FROM policy_r__shared_rule_set A
     INNER JOIN firewall F ON F.id=A.firewall
     WHERE A.id=? AND F.fwcloud=?`,
    [policyApplyId, fwcloud],
  );

  if (rows.length !== 1) {
    throw fwcError.NOT_FOUND;
  }

  return rows[0];
};

const appendUpdateField = (body, field, column, updates, params, transformer = null) => {
  if (!hasOwn(body, field)) {
    return;
  }

  updates.push(`${column}=?`);
  params.push(transformer ? transformer(body[field]) : body[field]);
};

const normalizeId = (value, fallback = -1) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return Number(value);
};

const firstDefined = (data, fields) => {
  for (const field of fields) {
    if (hasOwn(data, field) && data[field] !== undefined && data[field] !== null) {
      return data[field];
    }
  }

  return undefined;
};

const firstArrayFromBody = (body, fields) => {
  for (const field of fields) {
    if (Array.isArray(body[field])) {
      return body[field];
    }
  }

  return null;
};

const hasArrayField = (body, fields) => fields.some((field) => hasOwn(body, field));

const sharedRuleObjectPayload = (body) => {
  const ipObjFields = [
    'ipobjs',
    'ipObjects',
    'ip_objects',
    'rule_ipobjs',
    'policy_r__ipobj',
    'shared_rule__ipobj',
  ];
  const interfaceFields = [
    'interfaces',
    'rule_interfaces',
    'policy_r__interface',
    'shared_rule__interface',
  ];
  const positions = Array.isArray(body.positions) ? body.positions : null;
  const directIpObjs = firstArrayFromBody(body, ipObjFields);
  const directInterfaces = firstArrayFromBody(body, interfaceFields);

  const payload = {
    replaceIpObjs: hasArrayField(body, ipObjFields) || positions !== null,
    replaceInterfaces: hasArrayField(body, interfaceFields) || positions !== null,
    ipobjs: directIpObjs || [],
    interfaces: directInterfaces || [],
    positionObjects: [],
  };

  if (positions) {
    for (const position of positions) {
      const objects =
        firstArrayFromBody(position, ['ipobjs', 'objects', 'items', 'interfaces']) || [];
      const positionId = firstDefined(position, ['position', 'id', 'policyPositionId']);

      objects.forEach((object, index) => {
        payload.positionObjects.push({
          ...object,
          position: firstDefined(object, ['position', 'rule_position_id']) || positionId,
          position_order:
            firstDefined(object, ['position_order', 'order', 'node_order']) || index + 1,
        });
      });
    }
  }

  return payload;
};

const normalizeSharedInterfaceRow = (item, rule, index) => ({
  rule,
  interface: normalizeId(firstDefined(item, ['interface', 'interfaceId', 'id', 'obj_id'])),
  position: normalizeId(firstDefined(item, ['position', 'rule_position_id', 'policyPositionId'])),
  position_order: normalizeId(firstDefined(item, ['position_order', 'order', 'node_order']), index),
});

const normalizeSharedIPObjRow = (item, rule, index) => {
  const genericId = firstDefined(item, ['id', 'obj_id', 'object_id']);
  const type = Number(firstDefined(item, ['type', 'obj_type_id', 'object_type']));
  let ipobj = firstDefined(item, ['ipobj', 'ipObj', 'ipObjId', 'ipobjId']);
  let ipobj_g = firstDefined(item, ['ipobj_g', 'ipObjGroupId', 'ipobjGroupId', 'group', 'groupId']);
  let interfaceName = firstDefined(item, ['interface', 'interfaceId']);

  if (ipobj === undefined && ipobj_g === undefined && interfaceName === undefined) {
    if (type === 10 || type === 11) {
      interfaceName = genericId;
    } else if (type === 20 || type === 21 || type === 23) {
      ipobj_g = genericId;
    } else {
      ipobj = genericId;
    }
  }

  return {
    rule,
    ipobj: normalizeId(ipobj),
    ipobj_g: normalizeId(ipobj_g),
    interface: normalizeId(interfaceName),
    position: normalizeId(firstDefined(item, ['position', 'rule_position_id', 'policyPositionId'])),
    position_order: normalizeId(
      firstDefined(item, ['position_order', 'order', 'node_order']),
      index,
    ),
  };
};

const getPositionContentMap = async (queryRunner, rows) => {
  const positionIds = [...new Set(rows.map((row) => row.position).filter(isPositiveId))];
  const map = new Map();

  if (positionIds.length === 0) {
    return map;
  }

  const positionRows = await queryRunner.query(
    `SELECT id, content, policy_type
     FROM policy_position
     WHERE id IN (${positionIds.map(() => '?').join(',')})`,
    positionIds,
  );

  positionRows.forEach((position) => map.set(Number(position.id), position));
  return map;
};

const splitPositionObjectsByContent = async (queryRunner, payload, rule) => {
  if (payload.positionObjects.length === 0) {
    return;
  }

  const positionRows = payload.positionObjects.map((item, index) => ({
    item,
    index,
    position: normalizeId(firstDefined(item, ['position', 'rule_position_id', 'policyPositionId'])),
  }));
  const positionContentMap = await getPositionContentMap(queryRunner, positionRows);

  positionRows.forEach(({ item, index, position }) => {
    const positionData = positionContentMap.get(Number(position));
    if (!positionData) {
      throw fwcError.BAD_POSITION;
    }

    if (positionData.content === 'I') {
      payload.interfaces.push(normalizeSharedInterfaceRow(item, rule, index + 1));
    } else {
      payload.ipobjs.push(normalizeSharedIPObjRow(item, rule, index + 1));
    }
  });
};

const policyTypeIpVersion = (type) => {
  const policyType = Number(type);
  if (policyType >= 1 && policyType <= 5) {
    return 4;
  }

  if (policyType >= 61 && policyType <= 65) {
    return 6;
  }

  throw fwcError.NOT_ALLOWED;
};

const assertOneSharedIPObjReference = (row) => {
  const refs = [row.ipobj, row.ipobj_g, row.interface].filter(isPositiveId);

  if (refs.length !== 1) {
    throw fwcError.ONLY_ONE_NOT_NEGATIVE;
  }
};

const assertNoDuplicateSharedIPObjRows = (rows) => {
  const keys = new Set();

  for (const row of rows) {
    const key = `${row.ipobj}:${row.ipobj_g}:${row.interface}:${row.position}`;
    if (keys.has(key)) {
      throw fwcError.ALREADY_EXISTS;
    }
    keys.add(key);
  }
};

const assertNoDuplicateSharedInterfaceRows = (rows) => {
  const keys = new Set();

  for (const row of rows) {
    const key = `${row.interface}:${row.position}`;
    if (keys.has(key)) {
      throw fwcError.ALREADY_EXISTS;
    }
    keys.add(key);
  }
};

const validateSharedIPObjPosition = async (queryRunner, row, type) => {
  if (!isPositiveId(row.position)) {
    throw fwcError.BAD_POSITION;
  }

  let sql;
  let params;

  if (isPositiveId(row.ipobj)) {
    sql = `SELECT A.type
           FROM ipobj O
           INNER JOIN ipobj_type__policy_position A ON A.type=O.type
           INNER JOIN policy_position P ON P.id=A.position
           WHERE O.id=? AND A.position=? AND P.content='O' AND P.policy_type=?`;
    params = [row.ipobj, row.position, type];
  } else if (isPositiveId(row.ipobj_g)) {
    sql = `SELECT A.type
           FROM ipobj_g O
           INNER JOIN ipobj_type__policy_position A ON A.type=O.type
           INNER JOIN policy_position P ON P.id=A.position
           WHERE O.id=? AND A.position=? AND P.content='O' AND P.policy_type=?`;
    params = [row.ipobj_g, row.position, type];
  } else {
    sql = `SELECT A.type
           FROM interface I
           INNER JOIN ipobj_type__policy_position A ON A.type=I.interface_type
           INNER JOIN policy_position P ON P.id=A.position
           WHERE I.id=? AND A.position=? AND P.content='O' AND P.policy_type=?`;
    params = [row.interface, row.position, type];
  }

  const rows = await queryRunner.query(sql, params);
  if (rows.length === 0) {
    throw fwcError.NOT_ALLOWED;
  }
};

const validateSharedInterfacePosition = async (queryRunner, row, type) => {
  if (!isPositiveId(row.interface) || !isPositiveId(row.position)) {
    throw fwcError.BAD_POSITION;
  }

  const rows = await queryRunner.query(
    `SELECT A.type
     FROM interface I
     INNER JOIN ipobj_type__policy_position A ON A.type=I.interface_type
     INNER JOIN policy_position P ON P.id=A.position
     WHERE I.id=? AND I.firewall IS NOT NULL AND A.position=? AND P.content='I' AND P.policy_type=?`,
    [row.interface, row.position, type],
  );

  if (rows.length === 0) {
    throw fwcError.NOT_ALLOWED;
  }
};

const countSharedRuleGroupItems = async (queryRunner, group) => {
  const rows = await queryRunner.query(
    `SELECT (
       (SELECT COUNT(*) FROM ipobj__ipobjg WHERE ipobj_g=?) +
       (SELECT COUNT(*) FROM openvpn__ipobj_g WHERE ipobj_g=?) +
       (SELECT COUNT(*) FROM wireguard__ipobj_g WHERE ipobj_g=?) +
       (SELECT COUNT(*) FROM openvpn_prefix__ipobj_g WHERE ipobj_g=?) +
       (SELECT COUNT(*) FROM wireguard_prefix__ipobj_g WHERE ipobj_g=?) +
       (SELECT COUNT(*) FROM ipsec__ipobj_g WHERE ipobj_g=?) +
       (SELECT COUNT(*) FROM ipsec_prefix__ipobj_g WHERE ipobj_g=?)
     ) AS count`,
    [group, group, group, group, group, group, group],
  );

  return Number(rows[0].count);
};

const getSharedRuleGroupIPVersions = async (queryRunner, group) => {
  const ipVersions = { ipv4: false, ipv6: false };
  const ipObjRows = await queryRunner.query(
    `SELECT DISTINCT O.ip_version
     FROM ipobj__ipobjg G
     INNER JOIN ipobj O ON O.id=G.ipobj
     WHERE G.ipobj_g=? AND O.type<>8 AND O.ip_version IN (4, 6)

     UNION

     SELECT DISTINCT OIF.ip_version
     FROM ipobj__ipobjg G
     INNER JOIN ipobj H ON H.id=G.ipobj AND H.type=8
     INNER JOIN interface__ipobj II ON II.ipobj=H.id
     INNER JOIN ipobj OIF ON OIF.interface=II.interface
     WHERE G.ipobj_g=? AND OIF.ip_version IN (4, 6)`,
    [group, group],
  );

  ipObjRows.forEach((row) => {
    if (Number(row.ip_version) === 4) {
      ipVersions.ipv4 = true;
    } else if (Number(row.ip_version) === 6) {
      ipVersions.ipv6 = true;
    }
  });

  const vpnRows = await queryRunner.query(
    `SELECT (
       (SELECT COUNT(*) FROM openvpn__ipobj_g WHERE ipobj_g=?) +
       (SELECT COUNT(*) FROM openvpn_prefix__ipobj_g WHERE ipobj_g=?) +
       (SELECT COUNT(*) FROM wireguard__ipobj_g WHERE ipobj_g=?) +
       (SELECT COUNT(*) FROM wireguard_prefix__ipobj_g WHERE ipobj_g=?) +
       (SELECT COUNT(*) FROM ipsec__ipobj_g WHERE ipobj_g=?) +
       (SELECT COUNT(*) FROM ipsec_prefix__ipobj_g WHERE ipobj_g=?)
     ) AS count`,
    [group, group, group, group, group, group],
  );

  if (Number(vpnRows[0].count) > 0) {
    ipVersions.ipv4 = true;
  }

  return ipVersions;
};

const validateSharedIPObjNotEmpty = async (queryRunner, row, fwcloud, type) => {
  const ipVersion = policyTypeIpVersion(type);

  if (isPositiveId(row.interface)) {
    const interfaceRows = await queryRunner.query(
      `SELECT interface_type FROM interface WHERE id=?`,
      [row.interface],
    );

    if (interfaceRows.length !== 1) {
      throw fwcError.NOT_FOUND;
    }

    const interfaceType = Number(interfaceRows[0].interface_type);
    if (interfaceType === 10 || interfaceType === 11) {
      const addressRows = await queryRunner.query(
        `SELECT COUNT(*) AS count FROM ipobj WHERE interface=? AND ip_version=?`,
        [row.interface, ipVersion],
      );

      if (Number(addressRows[0].count) === 0) {
        throw fwcError.IPOBJ_EMPTY_CONTAINER;
      }
    }
  } else if (isPositiveId(row.ipobj)) {
    const ipObjRows = await queryRunner.query(`SELECT type FROM ipobj WHERE id=?`, [row.ipobj]);
    if (ipObjRows.length !== 1) {
      throw fwcError.NOT_FOUND;
    }

    if (Number(ipObjRows[0].type) === 8) {
      const addressRows = await queryRunner.query(
        `SELECT COUNT(*) AS count
         FROM interface__ipobj II
         INNER JOIN ipobj O ON O.interface=II.interface
         WHERE II.ipobj=? AND O.ip_version=?`,
        [row.ipobj, ipVersion],
      );

      if (Number(addressRows[0].count) === 0) {
        throw fwcError.IPOBJ_EMPTY_CONTAINER;
      }
    }
  } else if (isPositiveId(row.ipobj_g)) {
    const groupRows = await queryRunner.query(
      `SELECT type FROM ipobj_g WHERE id=? AND (fwcloud=? OR fwcloud IS NULL)`,
      [row.ipobj_g, fwcloud],
    );

    if (groupRows.length !== 1) {
      throw fwcError.NOT_FOUND;
    }

    const groupType = Number(groupRows[0].type);
    if (
      (groupType === 20 || groupType === 21) &&
      (await countSharedRuleGroupItems(queryRunner, row.ipobj_g)) === 0
    ) {
      throw fwcError.IPOBJ_EMPTY_CONTAINER;
    }
  }
};

const validateSharedIPObjIPVersion = async (queryRunner, row, fwcloud, type) => {
  const ipVersion = policyTypeIpVersion(type);

  if (isPositiveId(row.ipobj)) {
    const ipObjRows = await queryRunner.query(`SELECT ip_version, type FROM ipobj WHERE id=?`, [
      row.ipobj,
    ]);

    if (ipObjRows.length !== 1) {
      throw fwcError.NOT_FOUND;
    }

    const objectType = Number(ipObjRows[0].type);
    if (
      (objectType === 5 || objectType === 6 || objectType === 7) &&
      Number(ipObjRows[0].ip_version) !== ipVersion
    ) {
      throw fwcError.IPOBJ_BAD_IP_VERSION;
    }
  } else if (isPositiveId(row.ipobj_g)) {
    const groupRows = await queryRunner.query(
      `SELECT type FROM ipobj_g WHERE id=? AND (fwcloud=? OR fwcloud IS NULL)`,
      [row.ipobj_g, fwcloud],
    );

    if (groupRows.length !== 1) {
      throw fwcError.NOT_FOUND;
    }

    const groupType = Number(groupRows[0].type);
    if (groupType === 21 || groupType === 23) {
      return;
    }

    const groupIPVersions = await getSharedRuleGroupIPVersions(queryRunner, row.ipobj_g);
    if ((ipVersion === 4 && groupIPVersions.ipv4) || (ipVersion === 6 && groupIPVersions.ipv6)) {
      return;
    }

    throw fwcError.IPOBJ_BAD_IP_VERSION;
  }
};

const validateSharedIPObjRow = async (queryRunner, row, fwcloud, type) => {
  assertOneSharedIPObjReference(row);
  await validateSharedIPObjPosition(queryRunner, row, type);
  await validateSharedIPObjNotEmpty(queryRunner, row, fwcloud, type);
  await validateSharedIPObjIPVersion(queryRunner, row, fwcloud, type);
};

const insertSharedRuleIPObj = async (queryRunner, row) => {
  await queryRunner.query(
    `INSERT INTO shared_rule__ipobj
      (rule, ipobj, ipobj_g, interface, position, position_order)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [row.rule, row.ipobj, row.ipobj_g, row.interface, row.position, row.position_order],
  );
};

const insertSharedRuleInterface = async (queryRunner, row) => {
  await queryRunner.query(
    `INSERT INTO shared_rule__interface
      (rule, interface, position, position_order)
     VALUES (?, ?, ?, ?)`,
    [row.rule, row.interface, row.position, row.position_order],
  );
};

const normalizeSharedRuleIPObjOrders = async (queryRunner, rule) => {
  const rows = await queryRunner.query(
    `SELECT id_pi, position
     FROM shared_rule__ipobj
     WHERE rule=?
     ORDER BY position, position_order, id_pi`,
    [rule],
  );
  const positionOrders = new Map();

  for (const row of rows) {
    const nextOrder = (positionOrders.get(row.position) || 0) + 1;
    positionOrders.set(row.position, nextOrder);
    await queryRunner.query(`UPDATE shared_rule__ipobj SET position_order=? WHERE id_pi=?`, [
      nextOrder,
      row.id_pi,
    ]);
  }
};

const normalizeSharedRuleInterfaceOrders = async (queryRunner, rule) => {
  const rows = await queryRunner.query(
    `SELECT interface, position
     FROM shared_rule__interface
     WHERE rule=?
     ORDER BY position, position_order, interface`,
    [rule],
  );
  const positionOrders = new Map();

  for (const row of rows) {
    const nextOrder = (positionOrders.get(row.position) || 0) + 1;
    positionOrders.set(row.position, nextOrder);
    await queryRunner.query(
      `UPDATE shared_rule__interface
       SET position_order=?
       WHERE rule=? AND interface=? AND position=?`,
      [nextOrder, rule, row.interface, row.position],
    );
  }
};

const syncSharedRuleObjects = async (queryRunner, fwcloud, sharedRuleSet, rule, type, body) => {
  const payload = sharedRuleObjectPayload(body);

  if (!payload.replaceIpObjs && !payload.replaceInterfaces) {
    return;
  }

  await splitPositionObjectsByContent(queryRunner, payload, rule);

  const ipObjRows = payload.ipobjs.map((item, index) =>
    item.rule === rule && item.ipobj !== undefined
      ? item
      : normalizeSharedIPObjRow(item, rule, index + 1),
  );
  const interfaceRows = payload.interfaces.map((item, index) =>
    item.rule === rule && item.interface !== undefined && item.ipobj === undefined
      ? item
      : normalizeSharedInterfaceRow(item, rule, index + 1),
  );

  if (payload.replaceIpObjs) {
    assertNoDuplicateSharedIPObjRows(ipObjRows);
    await queryRunner.query(`DELETE FROM shared_rule__ipobj WHERE rule=?`, [rule]);

    for (const row of ipObjRows) {
      await validateSharedIPObjRow(queryRunner, row, fwcloud, type);
      await insertSharedRuleIPObj(queryRunner, row);
    }

    await normalizeSharedRuleIPObjOrders(queryRunner, rule);
  }

  if (payload.replaceInterfaces) {
    assertNoDuplicateSharedInterfaceRows(interfaceRows);
    await queryRunner.query(`DELETE FROM shared_rule__interface WHERE rule=?`, [rule]);

    for (const row of interfaceRows) {
      await validateSharedInterfacePosition(queryRunner, row, type);
      await insertSharedRuleInterface(queryRunner, row);
    }

    await normalizeSharedRuleInterfaceOrders(queryRunner, rule);
  }
};

const attachSharedRuleObjects = async (queryRunner, rules) => {
  if (!rules || rules.length === 0) {
    return rules;
  }

  const rulesById = new Map();
  const ruleIds = rules.map((rule) => {
    rule.ipobjs = [];
    rule.interfaces = [];
    rulesById.set(Number(rule.id), rule);
    return rule.id;
  });
  const placeholders = ruleIds.map(() => '?').join(',');

  const ipObjRows = await queryRunner.query(
    `SELECT *
     FROM shared_rule__ipobj
     WHERE rule IN (${placeholders})
     ORDER BY rule, position, position_order, id_pi`,
    ruleIds,
  );
  const interfaceRows = await queryRunner.query(
    `SELECT *
     FROM shared_rule__interface
     WHERE rule IN (${placeholders})
     ORDER BY rule, position, position_order, interface`,
    ruleIds,
  );

  ipObjRows.forEach((row) => rulesById.get(Number(row.rule))?.ipobjs.push(row));
  interfaceRows.forEach((row) => rulesById.get(Number(row.rule))?.interfaces.push(row));

  return rules;
};

export class SharedRulesService extends Service {
  constructor(app: AbstractApplication) {
    super(app);
  }

  public async get(body) {
    const filters = ['S.fwcloud=?'];
    const params = [body.fwcloud];

    if (body.shared_rule_set) {
      filters.push('S.id=?');
      params.push(body.shared_rule_set);
    }

    if (body.policy_type) {
      filters.push('S.policy_type=?');
      params.push(body.policy_type);
    }

    const data = await db.getSource().query(
      `SELECT S.*,
              (SELECT MIN(T.id)
               FROM fwc_tree T
               WHERE T.fwcloud=S.fwcloud AND T.node_type=? AND T.id_obj=S.id) AS node_id,
              (SELECT MIN(T.id)
               FROM fwc_tree T
               WHERE T.fwcloud=S.fwcloud
                 AND T.id_obj=S.policy_type
                 AND T.node_type=CASE S.policy_type
                   WHEN 1 THEN 'SRI'
                   WHEN 2 THEN 'SRO'
                   WHEN 3 THEN 'SRFW'
                   WHEN 4 THEN 'SRSN'
                   WHEN 5 THEN 'SRDN'
                   WHEN 61 THEN 'SRI6'
                   WHEN 62 THEN 'SRO6'
                   WHEN 63 THEN 'SRFW6'
                   WHEN 64 THEN 'SRSN6'
                   WHEN 65 THEN 'SRDN6'
                 END) AS policy_type_node_id,
              (SELECT COUNT(*)
               FROM shared_rule R
               WHERE R.shared_rule_set=S.id) AS rules_count,
              (SELECT COUNT(*)
               FROM policy_r__shared_rule_set A
               WHERE A.shared_rule_set=S.id) AS applications_count
       FROM shared_rule_set S
       WHERE ${filters.join(' AND ')}
       ORDER BY S.name`,
      [SHARED_RULE_SET_NODE_TYPE, ...params],
    );

    if (body.shared_rule_set && data.length === 0) {
      return undefined;
    }

    return body.shared_rule_set ? data[0] : data;
  }

  public async create(body) {
    return withTransaction(async (queryRunner) => {
      const insertResult = await queryRunner.query(
        `INSERT INTO shared_rule_set (fwcloud, name, policy_type, comment, style, active)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          body.fwcloud,
          body.name,
          body.policy_type,
          nullIfUndefined(body.comment),
          nullIfUndefined(body.style),
          body.active === undefined ? 1 : body.active,
        ],
      );

      const nodeId = await createSharedRuleSetTreeNode(
        queryRunner,
        body.fwcloud,
        insertResult.insertId,
        body.name,
        body.policy_type,
      );

      return { insertId: insertResult.insertId, TreeinsertId: nodeId };
    });
  }

  public async update(body): Promise<void> {
    await withTransaction(async (queryRunner) => {
      const sharedRuleSet = await getSharedRuleSet(queryRunner, body.fwcloud, body.shared_rule_set);
      const nextPolicyType = hasOwn(body, 'policy_type')
        ? body.policy_type
        : sharedRuleSet.policy_type;
      const nextName = hasOwn(body, 'name') ? body.name : sharedRuleSet.name;

      if (
        hasOwn(body, 'policy_type') &&
        Number(body.policy_type) !== Number(sharedRuleSet.policy_type)
      ) {
        const applications = await queryRunner.query(
          `SELECT COUNT(*) AS count
           FROM policy_r__shared_rule_set
           WHERE shared_rule_set=?`,
          [body.shared_rule_set],
        );

        if (Number(applications[0].count) > 0) {
          throw fwcError.NOT_ALLOWED;
        }

        await queryRunner.query(`UPDATE shared_rule SET type=? WHERE shared_rule_set=?`, [
          body.policy_type,
          body.shared_rule_set,
        ]);
      }

      const updates = [];
      const params = [];
      appendUpdateField(body, 'name', 'name', updates, params);
      appendUpdateField(body, 'policy_type', 'policy_type', updates, params);
      appendUpdateField(body, 'comment', 'comment', updates, params, nullIfUndefined);
      appendUpdateField(body, 'style', 'style', updates, params, nullIfUndefined);
      appendUpdateField(body, 'active', 'active', updates, params);

      if (updates.length > 0) {
        params.push(body.shared_rule_set, body.fwcloud);
        await queryRunner.query(
          `UPDATE shared_rule_set
           SET ${updates.join(', ')}
           WHERE id=? AND fwcloud=?`,
          params,
        );
      }

      if (hasOwn(body, 'name') || hasOwn(body, 'policy_type')) {
        await moveSharedRuleSetTreeNode(
          queryRunner,
          body.fwcloud,
          body.shared_rule_set,
          nextName,
          nextPolicyType,
        );
      }

      await assertSharedRuleSetApplicationsInterfacesAreCompatible(
        queryRunner,
        body.fwcloud,
        body.shared_rule_set,
      );
      await disableAppliedFirewallsCompileStatus(queryRunner, body.fwcloud, body.shared_rule_set);
    });
  }

  public async delete(body): Promise<void> {
    await withTransaction(async (queryRunner) => {
      await getSharedRuleSet(queryRunner, body.fwcloud, body.shared_rule_set);
      await disableAppliedFirewallsCompileStatus(queryRunner, body.fwcloud, body.shared_rule_set);
      await deleteSharedRuleSetTreeNode(queryRunner, body.fwcloud, body.shared_rule_set);
      await queryRunner.query(`DELETE FROM shared_rule_set WHERE id=? AND fwcloud=?`, [
        body.shared_rule_set,
        body.fwcloud,
      ]);
    });
  }

  public async getApplications(body) {
    const filters = ['S.fwcloud=?'];
    const params = [body.fwcloud];

    if (body.shared_rule_set) {
      filters.push('A.shared_rule_set=?');
      params.push(body.shared_rule_set);
    }

    if (body.firewall) {
      filters.push('A.firewall=?');
      params.push(body.firewall);
    }

    if (body.type) {
      filters.push('A.type=?');
      params.push(body.type);
    }

    const applications = await db.getSource().query(
      `SELECT A.*, S.name AS shared_rule_set_name, F.name AS firewall_name
       FROM policy_r__shared_rule_set A
       INNER JOIN shared_rule_set S ON S.id=A.shared_rule_set
       INNER JOIN firewall F ON F.id=A.firewall
       WHERE ${filters.join(' AND ')}
       ORDER BY F.name, A.type, A.rule_order`,
      params,
    );

    return applications;
  }

  public async apply(body) {
    return withTransaction(async (queryRunner) => {
      const sharedRuleSet = await getSharedRuleSet(queryRunner, body.fwcloud, body.shared_rule_set);
      const type = resolveApplyPolicyType(body);
      validatePolicyType(sharedRuleSet, type);
      await ensureFirewallInFwcloud(queryRunner, body.fwcloud, body.firewall);
      await assertSharedRuleSetIsNotApplied(queryRunner, body.firewall, type, body.shared_rule_set);
      await assertSharedRuleSetInterfacesAreCompatible(
        queryRunner,
        body.fwcloud,
        body.firewall,
        body.shared_rule_set,
      );

      const ruleOrder = body.rule_order
        ? body.rule_order
        : await getNextPolicyOrder(queryRunner, body.firewall, type);
      await reorderPolicyAfterRuleOrder(queryRunner, body.firewall, type, ruleOrder);

      let insertResult;
      try {
        insertResult = await queryRunner.query(
          `INSERT INTO policy_r__shared_rule_set
            (firewall, type, shared_rule_set, rule_order, active, style)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            body.firewall,
            type,
            body.shared_rule_set,
            ruleOrder,
            body.active === undefined ? 1 : body.active,
            nullIfUndefined(body.style),
          ],
        );
      } catch (error) {
        if (isDuplicateEntryError(error)) {
          throw fwcError.SHARED_RULE_SET_ALREADY_APPLIED;
        }
        throw error;
      }

      await disableFirewallCompileStatus(queryRunner, body.fwcloud, body.firewall);

      return { insertId: insertResult.insertId };
    });
  }

  public async updateApplication(body): Promise<void> {
    await withTransaction(async (queryRunner) => {
      const policyApply = await getPolicyApply(queryRunner, body.fwcloud, body.policyApplyId);

      if (hasOwn(body, 'rule_order')) {
        await movePolicyApplyOrder(
          queryRunner,
          policyApply.firewall,
          policyApply.type,
          policyApply.id,
          policyApply.rule_order,
          body.rule_order,
        );
      }

      const updates = [];
      const params = [];
      appendUpdateField(body, 'rule_order', 'rule_order', updates, params);
      appendUpdateField(body, 'active', 'active', updates, params);
      appendUpdateField(body, 'style', 'style', updates, params, nullIfUndefined);

      if (updates.length > 0) {
        params.push(body.policyApplyId);
        await queryRunner.query(
          `UPDATE policy_r__shared_rule_set
           SET ${updates.join(', ')}
           WHERE id=?`,
          params,
        );
      }

      await disableFirewallCompileStatus(queryRunner, body.fwcloud, policyApply.firewall);
    });
  }

  public async unapply(body): Promise<void> {
    await withTransaction(async (queryRunner) => {
      const policyApply = await getPolicyApply(queryRunner, body.fwcloud, body.policyApplyId);

      await queryRunner.query(`DELETE FROM policy_r__shared_rule_set WHERE id=?`, [
        body.policyApplyId,
      ]);
      await compactPolicyOrdersAfterDelete(
        queryRunner,
        policyApply.firewall,
        policyApply.type,
        policyApply.rule_order,
      );
      await disableFirewallCompileStatus(queryRunner, body.fwcloud, policyApply.firewall);
    });
  }

  public async getRules(body) {
    await getSharedRuleSet(db.getSource(), body.fwcloud, body.shared_rule_set);
    const rules = await db.getSource().query(
      `SELECT *
       FROM shared_rule
       WHERE shared_rule_set=?
       ORDER BY rule_order, id`,
      [body.shared_rule_set],
    );

    return attachSharedRuleObjects(db.getSource(), rules);
  }

  public async createRule(body) {
    return withTransaction(async (queryRunner) => {
      const sharedRuleSet = await getSharedRuleSet(queryRunner, body.fwcloud, body.shared_rule_set);
      const type = body.type ? body.type : sharedRuleSet.policy_type;
      validatePolicyType(sharedRuleSet, type);
      validateMark(body.mark, type);

      const ruleOrder = body.rule_order
        ? body.rule_order
        : await getNextSharedRuleOrder(queryRunner, body.shared_rule_set);

      await queryRunner.query(
        `UPDATE shared_rule
         SET rule_order=rule_order+1
         WHERE shared_rule_set=? AND rule_order>=?`,
        [body.shared_rule_set, ruleOrder],
      );

      const insertResult = await queryRunner.query(
        `INSERT INTO shared_rule
          (shared_rule_set, rule_order, direction, action, time_start, time_end, comment, options,
           active, type, style, fw_apply_to, negate, mark, special, run_before, run_after)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          body.shared_rule_set,
          ruleOrder,
          nullIfUndefined(body.direction),
          body.action,
          nullIfUndefined(body.time_start),
          nullIfUndefined(body.time_end),
          nullIfUndefined(body.comment),
          body.options === undefined ? 0 : body.options,
          body.active === undefined ? 1 : body.active,
          type,
          nullIfUndefined(body.style),
          nullIfUndefined(body.fw_apply_to),
          nullIfUndefined(body.negate),
          nullIfZero(body.mark),
          body.special === undefined ? 0 : body.special,
          nullIfUndefined(body.run_before),
          nullIfUndefined(body.run_after),
        ],
      );

      await syncSharedRuleObjects(
        queryRunner,
        body.fwcloud,
        body.shared_rule_set,
        insertResult.insertId,
        type,
        body,
      );
      await assertSharedRuleSetApplicationsInterfacesAreCompatible(
        queryRunner,
        body.fwcloud,
        body.shared_rule_set,
      );
      await disableAppliedFirewallsCompileStatus(queryRunner, body.fwcloud, body.shared_rule_set);

      return { insertId: insertResult.insertId };
    });
  }

  public async updateRule(body): Promise<void> {
    await withTransaction(async (queryRunner) => {
      const sharedRuleSet = await getSharedRuleSet(queryRunner, body.fwcloud, body.shared_rule_set);
      const sharedRule = await getSharedRule(
        queryRunner,
        body.fwcloud,
        body.shared_rule_set,
        body.rule,
      );

      if (hasOwn(body, 'type')) {
        validatePolicyType(sharedRuleSet, body.type);
      }

      const type = hasOwn(body, 'type') ? body.type : sharedRule.type;
      validateMark(body.mark, type);

      if (hasOwn(body, 'rule_order')) {
        await moveSharedRuleOrder(
          queryRunner,
          body.shared_rule_set,
          body.rule,
          sharedRule.rule_order,
          body.rule_order,
        );
      }

      const updates = [];
      const params = [];
      appendUpdateField(body, 'rule_order', 'rule_order', updates, params);
      appendUpdateField(body, 'direction', 'direction', updates, params, nullIfUndefined);
      appendUpdateField(body, 'action', 'action', updates, params);
      appendUpdateField(body, 'time_start', 'time_start', updates, params, nullIfUndefined);
      appendUpdateField(body, 'time_end', 'time_end', updates, params, nullIfUndefined);
      appendUpdateField(body, 'comment', 'comment', updates, params, nullIfUndefined);
      appendUpdateField(body, 'options', 'options', updates, params);
      appendUpdateField(body, 'active', 'active', updates, params);
      appendUpdateField(body, 'type', 'type', updates, params);
      appendUpdateField(body, 'style', 'style', updates, params, nullIfUndefined);
      appendUpdateField(body, 'fw_apply_to', 'fw_apply_to', updates, params, nullIfUndefined);
      appendUpdateField(body, 'negate', 'negate', updates, params, nullIfUndefined);
      appendUpdateField(body, 'mark', 'mark', updates, params, nullIfZero);
      appendUpdateField(body, 'special', 'special', updates, params);
      appendUpdateField(body, 'run_before', 'run_before', updates, params, nullIfUndefined);
      appendUpdateField(body, 'run_after', 'run_after', updates, params, nullIfUndefined);

      if (updates.length > 0) {
        params.push(body.rule, body.shared_rule_set);
        await queryRunner.query(
          `UPDATE shared_rule
           SET ${updates.join(', ')}
           WHERE id=? AND shared_rule_set=?`,
          params,
        );
      }

      await syncSharedRuleObjects(
        queryRunner,
        body.fwcloud,
        body.shared_rule_set,
        body.rule,
        type,
        body,
      );
      await assertSharedRuleSetApplicationsInterfacesAreCompatible(
        queryRunner,
        body.fwcloud,
        body.shared_rule_set,
      );
      await disableAppliedFirewallsCompileStatus(queryRunner, body.fwcloud, body.shared_rule_set);
    });
  }

  public async deleteRules(body): Promise<void> {
    if (body.rulesIds.length === 0) {
      return;
    }

    await withTransaction(async (queryRunner) => {
      await getSharedRuleSet(queryRunner, body.fwcloud, body.shared_rule_set);

      await queryRunner.query(
        `DELETE FROM shared_rule
         WHERE shared_rule_set=? AND id IN (${body.rulesIds.map(() => '?').join(',')})`,
        [body.shared_rule_set, ...body.rulesIds],
      );
      await compactSharedRuleOrders(queryRunner, body.shared_rule_set);
      await assertSharedRuleSetApplicationsInterfacesAreCompatible(
        queryRunner,
        body.fwcloud,
        body.shared_rule_set,
      );
      await disableAppliedFirewallsCompileStatus(queryRunner, body.fwcloud, body.shared_rule_set);
    });
  }
}
