import request = require('supertest');
import sinon = require('sinon');
import { expect, testSuite } from '../../mocha/global-setup';
import { useProductionAuthentication } from '../../utils/production-auth-harness';
import {
  assignClouds,
  loginPayload,
  securityAccount,
  securityLogin,
  securityResource,
  SecurityAccount,
  SecurityResource,
  SecuritySession,
} from '../../utils/security-fixtures';
import { User } from '../../../src/models/user/User';
import { UserRole } from '../../../src/models/user/user-role';
import { PgpHelper } from '../../../src/utils/pgp';
import { FwCloud } from '../../../src/models/fwcloud/FwCloud';
import { Tree } from '../../../src/models/tree/Tree';
import db from '../../../src/database/database-manager';

describe('Security: administrator-created read-only users', () => {
  useProductionAuthentication();
  let admin: SecurityAccount;
  let adminSession: SecuritySession;
  let resource: SecurityResource;
  let other: SecurityResource;
  let sandbox: sinon.SinonSandbox;
  const password = 'ReaderPass!1234';

  beforeEach(async () => {
    await testSuite.resetDatabaseData();
    sandbox = sinon.createSandbox();
    admin = await securityAccount(1);
    resource = await securityResource('assigned reader cloud');
    other = await securityResource('unassigned reader cloud');
    await Tree.createAllTreeCloud(resource.fwcloud);
    await assignClouds(admin, [resource.fwcloud, other.fwcloud]);
    adminSession = await securityLogin(admin);
    testSuite.app.config.set('confirmation_token', true);
  });
  afterEach(() => sandbox?.restore());

  async function createReader(): Promise<SecurityAccount> {
    const encrypted = await new PgpHelper({ public: adminSession.publicKey, private: '' }).encrypt(
      password,
    );
    const response = await request(testSuite.app.express)
      .post('/user')
      .set('Cookie', adminSession.cookie)
      .set('x-fwc-confirm-token', admin.user.confirmation_token)
      .send({
        customer: 1,
        name: 'Read-only user',
        username: 'newreader',
        email: 'reader@example.com',
        password: encrypted,
        role: UserRole.Viewer,
        enabled: 1,
        allowed_from: '',
      })
      .expect((response) => expect(response.status, JSON.stringify(response.body)).to.equal(200));
    const user = await User.findOneByOrFail({ id: response.body.user });
    return { user, password };
  }

  async function grantCloud(user: User) {
    await request(testSuite.app.express)
      .post('/user/fwcloud')
      .set('Cookie', adminSession.cookie)
      .set('x-fwc-confirm-token', admin.user.confirmation_token)
      .send({ user: user.id, fwcloud: resource.fwcloud.id })
      .expect(204);
  }

  it('persists the new role without administrator privileges or automatic cloud access', async () => {
    const reader = await createReader();
    const saved = await User.findOneOrFail({
      where: { id: reader.user.id },
      relations: { fwClouds: true },
    });
    expect(saved.role).to.equal(UserRole.Viewer);
    expect(saved.fwClouds).to.deep.equal([]);
    const login = await request(testSuite.app.express)
      .post('/user/login')
      .send(loginPayload(reader))
      .expect(200);
    expect(login.body.role).to.equal(UserRole.Viewer);
  });

  it('does not let a manager create an account even when the requested role is read-only', async () => {
    const manager = await securityAccount(2);
    const session = await securityLogin(manager);
    const encrypted = await new PgpHelper({ public: session.publicKey, private: '' }).encrypt(
      password,
    );
    const count = await User.count();
    const response = await request(testSuite.app.express)
      .post('/user')
      .set('Cookie', session.cookie)
      .set('x-fwc-confirm-token', manager.user.confirmation_token)
      .send({
        customer: 1,
        name: 'Denied reader',
        username: 'deniedreader',
        password: encrypted,
        role: UserRole.Viewer,
        enabled: 1,
        allowed_from: '',
      })
      .expect(400);
    expect(response.body.fwcErr).to.equal(1008);
    expect(await User.count()).to.equal(count);
  });

  it('assigns only selected clouds and lists only those clouds after reader login', async () => {
    const reader = await createReader();
    await grantCloud(reader.user);
    const session = await securityLogin(reader);
    const response = await request(testSuite.app.express)
      .get('/fwcloud/all/get')
      .set('Cookie', session.cookie)
      .expect(200);
    expect(response.body.map((cloud) => cloud.id)).to.deep.equal([resource.fwcloud.id]);
    await request(testSuite.app.express)
      .put('/fwcloud/get')
      .set('Cookie', session.cookie)
      .send({ fwcloud: other.fwcloud.id })
      .expect(400);
  });

  it('loads the initial dashboard and policy without acquiring locks or changing functional data', async () => {
    const reader = await createReader();
    await grantCloud(reader.user);
    const session = await securityLogin(reader);
    const lock = sandbox.spy(FwCloud, 'updateFwcloudLock');
    const snapshot = async () => ({
      tree: await db.getSource().manager.query('SELECT * FROM fwc_tree ORDER BY id'),
      cloud: await FwCloud.findOneByOrFail({ id: resource.fwcloud.id }),
    });
    const before = await snapshot();
    for (const path of [
      '/config',
      '/fwcloud/all/get',
      '/ipobj/types',
      '/ipobj/positions/policy',
      '/policy/types',
    ]) {
      await request(testSuite.app.express).get(path).set('Cookie', session.cookie).expect(200);
    }
    for (const path of [
      '/tree/firewalls/get',
      '/tree/objects/get',
      '/tree/services/get',
      '/tree/ca/get',
      '/firewall/cloud/get',
      '/cluster/cloud/get',
    ]) {
      await request(testSuite.app.express)
        .put(path)
        .set('Cookie', session.cookie)
        .send({ fwcloud: resource.fwcloud.id })
        .expect(200);
    }
    for (const path of ['/policy/rule/type/get', '/policy/rule/type/grouped/get']) {
      await request(testSuite.app.express)
        .put(path)
        .set('Cookie', session.cookie)
        .send({ fwcloud: resource.fwcloud.id, firewall: resource.firewall.id, type: 1 })
        .expect(200);
    }
    await request(testSuite.app.express)
      .put('/policy/positions/get')
      .set('Cookie', session.cookie)
      .send({ type: 1 })
      .expect(200);
    expect(await snapshot()).to.deep.equal(before);
    expect(lock.called).to.equal(false);
  });

  it('does not initialize missing country nodes when a reader consults a legacy cloud', async () => {
    const root = await Tree.dumpTree(db.getQuery(), 'COUNTRIES', resource.fwcloud.id);
    await Tree.deleteFwc_TreeFullNode({ fwcloud: resource.fwcloud.id, id: root.id });
    const reader = await createReader();
    await grantCloud(reader.user);
    const session = await securityLogin(reader);
    const create = sandbox.spy(Tree, 'createCountriesTree');
    const before = await db.getSource().manager.query('SELECT * FROM fwc_tree ORDER BY id');
    const response = await request(testSuite.app.express)
      .put('/tree/objects/get')
      .set('Cookie', session.cookie)
      .send({ fwcloud: resource.fwcloud.id })
      .expect(200);
    expect(response.body[1]).to.include({ id: 0, text: 'COUNTRIES' });
    expect(create.called).to.equal(false);
    expect(await db.getSource().manager.query('SELECT * FROM fwc_tree ORDER BY id')).to.deep.equal(
      before,
    );
  });

  it('allows administrators to edit an existing user into the new role', async () => {
    const manager = await securityAccount(2);
    await assignClouds(manager, [resource.fwcloud]);
    await request(testSuite.app.express)
      .put('/user')
      .set('Cookie', adminSession.cookie)
      .set('x-fwc-confirm-token', admin.user.confirmation_token)
      .send({
        customer: 1,
        user: manager.user.id,
        name: 'Updated reader',
        username: manager.user.username,
        email: 'reader@example.com',
        enabled: 1,
        role: UserRole.Viewer,
        allowed_from: '',
      })
      .expect(204);
    const user = await User.findOneOrFail({
      where: { id: manager.user.id },
      relations: { fwClouds: true },
    });
    expect(user.role).to.equal(UserRole.Viewer);
    expect(user.fwClouds.map((cloud) => cloud.id)).to.deep.equal([resource.fwcloud.id]);
  });

  it('denies readers user creation, self-editing, role escalation, cloud assignment and locks', async () => {
    const reader = await createReader();
    await grantCloud(reader.user);
    const session = await securityLogin(reader);
    const before = await User.findOneByOrFail({ id: reader.user.id });
    for (const [method, path] of [
      ['post', '/user'],
      ['put', '/user'],
      ['put', '/user/changepass'],
      ['post', '/user/fwcloud'],
      ['put', '/fwcloud/lock'],
      ['put', '/fwcloud/forcelock'],
      ['post', '/policy/install'],
      ['put', '/policy/rule'],
    ]) {
      const response = await request(testSuite.app.express)
        [method](path)
        .set('Cookie', session.cookie)
        .send({ user: reader.user.id, role: 1, fwcloud: other.fwcloud.id })
        .expect(403);
      expect(response.body.fwcErr).to.equal(7013);
      expect(response.body).not.to.have.property('fwc_confirm_token');
    }
    expect(await User.findOneByOrFail({ id: reader.user.id })).to.deep.equal(before);
  });
});
