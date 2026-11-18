const fs = require('node:fs');
const { privateFile, requireLab } = require('./environment.cjs');

// Only called after the CI startup has verified an empty fwcloud_zap database.
async function seed() {
  const {
    createSecurityAccount,
    createSecurityResource,
  } = require('../../dist/tests/utils/security-data');
  const model = (file) => require(`../../dist/src/models/${file}`);
  const { Customer } = model('user/Customer');
  const { User } = model('user/User');
  const { Tfa } = model('user/Tfa');
  const { FwCloud } = model('fwcloud/FwCloud');
  const { IPObj } = model('ipobj/IPObj');
  const { IPObjType } = model('ipobj/IPObjType');
  const { PolicyRule } = model('policy/PolicyRule');
  const { PolicyType } = model('policy/PolicyType');
  const customer = await Customer.create({ name: 'Disposable ZAP customer' }).save();
  await IPObjType.create({ id: 5, type: 'ADDRESS', protocol_number: null }).save();
  await PolicyType.create({ id: 1, type: 'I', type_order: '1', show_action: 1 }).save();
  const accounts = {};
  for (const [name, role] of [
    ['admin', 1],
    ['a', 2],
    ['b', 2],
    ['mfa', 2],
  ]) {
    const { user, password } = await createSecurityAccount(customer.id, role);
    accounts[name] = {
      id: user.id,
      customer: customer.id,
      username: user.username,
      password,
      token: user.confirmation_token,
      role,
    };
  }
  const secret = require('speakeasy').generateSecret().base32;
  await Tfa.create({
    userId: accounts.mfa.id,
    secret,
    tempSecret: '',
    dataURL: '',
    tfaURL: '',
  }).save();
  accounts.mfa.secret = secret;
  const resources = {};
  for (const name of ['a', 'b']) {
    const {
      fwcloud: cloud,
      firewall,
      table,
      route,
    } = await createSecurityResource(`CI cloud ${name}`);
    const ipobj = await IPObj.create({
      name: `CI address ${name}`,
      fwCloudId: cloud.id,
      ipObjTypeId: 5,
      address: name === 'a' ? '192.0.2.10' : '192.0.2.20',
      ip_version: 4,
    }).save();
    const rule = await PolicyRule.create({
      firewallId: firewall.id,
      policyTypeId: 1,
      rule_order: 1,
      action: 1,
      active: 1,
      options: 0,
      comment: 'Synthetic CI policy',
    }).save();
    resources[name] = {
      cloud: cloud.id,
      firewall: firewall.id,
      table: table.id,
      route: route.id,
      ipobj: ipobj.id,
      rule: rule.id,
    };
    const user = await User.findOneByOrFail({ id: accounts[name].id });
    user.fwClouds = [cloud];
    await user.save();
  }
  const admin = await User.findOneByOrFail({ id: accounts.admin.id });
  admin.fwClouds = await FwCloud.find();
  await admin.save();
  fs.writeFileSync(privateFile('fixture'), JSON.stringify({ accounts, resources }), {
    mode: 0o600,
  });
}
module.exports = seed;

if (require.main === module) {
  requireLab();
  require('reflect-metadata');
  process.env.LOGS_DIRECTORY = require('node:path').join(process.env.RUNNER_TEMP, 'zap-api-logs');
  (async () => {
    const { Application } = require('../../dist/src/Application');
    const { User } = require('../../dist/src/models/user/User');
    const { FwCloud } = require('../../dist/src/models/fwcloud/FwCloud');
    const app = await Application.run();
    try {
      if ((await User.count()) || (await FwCloud.count()))
        throw new Error('Synthetic fixture database must have no accounts or clouds.');
      await seed();
    } finally {
      await app.close();
    }
    // Application services can retain timers; all persistence/close operations above are awaited.
  })()
    .then(() => process.exit(0))
    .catch(() => {
      console.error('Disposable fixture creation failed.');
      process.exit(1);
    });
}
