const fwcError = require('../../utils/error_table');

const interfaceNameExpression = (alias, interfaceUpdate) => {
  if (!interfaceUpdate) {
    return `${alias}.name`;
  }

  return `CASE WHEN ${alias}.id=? THEN ? ELSE ${alias}.name END`;
};

const interfaceNameParams = (interfaceUpdate) => {
  if (!interfaceUpdate) {
    return [];
  }

  return [interfaceUpdate.id, interfaceUpdate.name];
};

const getSharedRuleSetRequiredInterfaceNames = async (
  queryRunner,
  sharedRuleSet,
  interfaceUpdate = null,
) => {
  const sql = `
    SELECT DISTINCT required_interfaces.name
    FROM (
      SELECT ${interfaceNameExpression('I', interfaceUpdate)} AS name
      FROM shared_rule__interface RI
      INNER JOIN shared_rule R ON R.id=RI.rule
      INNER JOIN interface I ON I.id=RI.interface
      WHERE R.shared_rule_set=? AND I.firewall IS NOT NULL

      UNION

      SELECT ${interfaceNameExpression('I', interfaceUpdate)} AS name
      FROM shared_rule__ipobj RO
      INNER JOIN shared_rule R ON R.id=RO.rule
      INNER JOIN interface I ON I.id=RO.interface
      WHERE R.shared_rule_set=?
        AND RO.interface IS NOT NULL
        AND RO.interface > 0
        AND I.firewall IS NOT NULL
    ) required_interfaces
    WHERE required_interfaces.name IS NOT NULL AND required_interfaces.name<>''`;

  const rows = await queryRunner.query(sql, [
    ...interfaceNameParams(interfaceUpdate),
    sharedRuleSet,
    ...interfaceNameParams(interfaceUpdate),
    sharedRuleSet,
  ]);

  return rows.map((row) => row.name);
};

const getFirewallInterfaceNames = async (
  queryRunner,
  fwcloud,
  firewall,
  interfaceUpdate = null,
) => {
  const rows = await queryRunner.query(
    `SELECT DISTINCT ${interfaceNameExpression('I', interfaceUpdate)} AS name
     FROM interface I
     INNER JOIN firewall F ON F.id=I.firewall
     WHERE F.fwcloud=? AND I.firewall=? AND I.name IS NOT NULL AND I.name<>''`,
    [...interfaceNameParams(interfaceUpdate), fwcloud, firewall],
  );

  return new Set(rows.map((row) => row.name));
};

export const assertSharedRuleSetInterfacesAreCompatible = async (
  queryRunner,
  fwcloud,
  firewall,
  sharedRuleSet,
  interfaceUpdate = null,
) => {
  const requiredNames = await getSharedRuleSetRequiredInterfaceNames(
    queryRunner,
    sharedRuleSet,
    interfaceUpdate,
  );

  if (requiredNames.length === 0) {
    return;
  }

  const firewallInterfaceNames = await getFirewallInterfaceNames(
    queryRunner,
    fwcloud,
    firewall,
    interfaceUpdate,
  );
  const missingNames = requiredNames.filter((name) => !firewallInterfaceNames.has(name));

  if (missingNames.length > 0) {
    throw fwcError.NOT_ALLOWED;
  }
};

export const assertSharedRuleSetApplicationsInterfacesAreCompatible = async (
  queryRunner,
  fwcloud,
  sharedRuleSet,
  interfaceUpdate = null,
) => {
  const applications = await queryRunner.query(
    `SELECT A.firewall
     FROM policy_r__shared_rule_set A
     INNER JOIN firewall F ON F.id=A.firewall
     WHERE F.fwcloud=? AND A.shared_rule_set=?`,
    [fwcloud, sharedRuleSet],
  );

  for (const application of applications) {
    await assertSharedRuleSetInterfacesAreCompatible(
      queryRunner,
      fwcloud,
      application.firewall,
      sharedRuleSet,
      interfaceUpdate,
    );
  }
};

const getSharedRuleSetsAffectedByInterfaceUpdate = async (queryRunner, fwcloud, interfaceId) => {
  const rows = await queryRunner.query(
    `SELECT DISTINCT affected.shared_rule_set
     FROM (
       SELECT R.shared_rule_set
       FROM shared_rule__interface RI
       INNER JOIN shared_rule R ON R.id=RI.rule
       INNER JOIN shared_rule_set S ON S.id=R.shared_rule_set
       WHERE S.fwcloud=? AND RI.interface=?

       UNION

       SELECT R.shared_rule_set
       FROM shared_rule__ipobj RO
       INNER JOIN shared_rule R ON R.id=RO.rule
       INNER JOIN shared_rule_set S ON S.id=R.shared_rule_set
       WHERE S.fwcloud=? AND RO.interface=?

       UNION

       SELECT A.shared_rule_set
       FROM policy_r__shared_rule_set A
       INNER JOIN firewall F ON F.id=A.firewall
       INNER JOIN interface I ON I.firewall=F.id
       WHERE F.fwcloud=? AND I.id=?
     ) affected`,
    [fwcloud, interfaceId, fwcloud, interfaceId, fwcloud, interfaceId],
  );

  return rows.map((row) => row.shared_rule_set);
};

export const assertInterfaceUpdateKeepsSharedRuleApplicationsCompatible = async (
  queryRunner,
  fwcloud,
  interfaceId,
  nextName,
) => {
  if (nextName === undefined || nextName === null) {
    return;
  }

  const affectedSharedRuleSets = await getSharedRuleSetsAffectedByInterfaceUpdate(
    queryRunner,
    fwcloud,
    interfaceId,
  );

  const interfaceUpdate = {
    id: interfaceId,
    name: nextName,
  };

  for (const sharedRuleSet of affectedSharedRuleSets) {
    await assertSharedRuleSetApplicationsInterfacesAreCompatible(
      queryRunner,
      fwcloud,
      sharedRuleSet,
      interfaceUpdate,
    );
  }
};
