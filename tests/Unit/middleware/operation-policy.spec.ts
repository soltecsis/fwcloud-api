import express from 'express';
import request from 'supertest';
import { expect } from 'chai';
import sinon from 'sinon';
import { OperationRegistry } from '../../../src/authorization/operation-registry';
import {
  consultationOperation,
  OperationPolicy,
} from '../../../src/authorization/operation-policy';
import {
  createOperationRouter,
  legacyOperation,
  registerLegacyOperations,
} from '../../../src/authorization/legacy-operation';
import { ResolveOperation } from '../../../src/middleware/ResolveOperation';
import { ReadOnlyValidation } from '../../../src/middleware/ReadOnlyValidation';
import { ConfirmationToken } from '../../../src/middleware/confirmation-token.middleware';
import { LockValidation } from '../../../src/middleware/LockValidation';
import { FwCloud } from '../../../src/models/fwcloud/FwCloud';
import { User } from '../../../src/models/user/User';
import { UserRole } from '../../../src/models/user/user-role';

describe('Route-declared operation policies', () => {
  let sandbox: sinon.SinonSandbox;
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });
  afterEach(() => sandbox.restore());

  it('matches method and complete route template, without inferring permissions from GET or /get', () => {
    const registry = new OperationRegistry();
    registry.register(
      'GET',
      '/fwclouds/:fwcloud/firewalls/:firewall/routingTables/:table/grid',
      consultationOperation,
    );
    expect(registry.resolve('GET', '/fwclouds/1/firewalls/2/routingTables/3/grid')).to.deep.equal(
      consultationOperation,
    );
    expect(registry.resolve('GET', '/fwclouds/1/firewalls/2/routingTables/3/grid/extra')).to.equal(
      undefined,
    );
    expect(registry.resolve('POST', '/fwclouds/1/firewalls/2/routingTables/3/grid')).to.equal(
      undefined,
    );
    expect(registry.resolve('GET', '/new/compile')).to.equal(undefined);
    expect(registry.resolve('PUT', '/new/get')).to.equal(undefined);
  });

  it('keeps earlier unclassified routes authoritative and snapshots policy values', () => {
    const registry = new OperationRegistry();
    const policy = { ...consultationOperation };
    registry.register('GET', '/items/compile');
    registry.register('GET', '/items/:id', policy);
    policy.viewerAllowed = false;
    expect(registry.resolve('GET', '/items/compile')).to.equal(undefined);
    expect(registry.resolve('GET', '/items/12')?.viewerAllowed).to.equal(true);
    expect(Object.isFrozen(registry.resolve('GET', '/items/12'))).to.equal(true);
    registry.clear();
    expect(registry.resolve('GET', '/items/12')).to.equal(undefined);
  });

  it('records classified and unclassified legacy handlers without Express private-stack inspection', async () => {
    const registry = new OperationRegistry();
    const router = createOperationRouter();
    router.get('/compile', (_req, res) => {
      res.sendStatus(204);
    });
    legacyOperation(router, 'get', '/:id', consultationOperation, (_req, res) => {
      res.sendStatus(204);
    });
    registerLegacyOperations(registry, '/legacy', router);
    expect(registry.resolve('GET', '/legacy/compile')).to.equal(undefined);
    expect(registry.resolve('GET', '/legacy/4')?.viewerAllowed).to.equal(true);
    const app = express();
    app.use('/legacy', router);
    await request(app).get('/legacy/4').expect(204);
  });

  it('registers every unclassified legacy alias without granting it consultation permissions', () => {
    const registry = new OperationRegistry();
    const router = createOperationRouter();
    router.put(['/negate', '/allow'], (_req, res) => {
      res.sendStatus(204);
    });
    legacyOperation(router, 'put', '/:id', consultationOperation, (_req, res) => {
      res.sendStatus(204);
    });
    registerLegacyOperations(registry, '/positions', router);
    expect(registry.resolve('PUT', '/positions/negate')).to.equal(undefined);
    expect(registry.resolve('PUT', '/positions/allow')).to.equal(undefined);
    expect(registry.resolve('PUT', '/positions/10')?.viewerAllowed).to.equal(true);
  });

  function pipeline(role: UserRole, policy?: OperationPolicy) {
    const app = express();
    const registry = new OperationRegistry();
    registry.register('POST', '/operation', policy);
    const resolve = sandbox.spy(registry, 'resolve');
    app.use(express.json());
    app.use((req, _res, next) => {
      req.session = {
        user: { id: 7, role, confirmation_token: null } as User,
        user_id: 7,
      } as unknown as typeof req.session;
      next();
    });
    const application = {
      express: app,
      config: { get: () => true },
      getService: async () => ({
        resolveOperation: (method: string, path: string) => registry.resolve(method, path),
      }),
    };
    new ResolveOperation().register(application as any);
    new ReadOnlyValidation().register(application as any);
    const confirmation = new ConfirmationToken();
    const token = sandbox
      .stub(confirmation as any, 'generateNewConfirmationToken')
      .resolves('test-token');
    confirmation.register(application as any);
    new LockValidation().register(application as any);
    const downstream = sandbox.spy();
    app.use((_req, res) => {
      downstream();
      res.sendStatus(204);
    });
    return { app, resolve, token, downstream };
  }

  it('resolves once and permits reviewed POST consultation without generating tokens or acquiring locks', async () => {
    const access = sandbox.spy(FwCloud, 'getFwcloudAccess');
    const lock = sandbox.spy(FwCloud, 'updateFwcloudLock');
    const { app, resolve, token, downstream } = pipeline(UserRole.Viewer, consultationOperation);
    await request(app).post('/operation').send({}).expect(204);
    expect(resolve.calledOnce).to.equal(true);
    expect(token.called).to.equal(false);
    expect(access.called).to.equal(false);
    expect(lock.called).to.equal(false);
    expect(downstream.calledOnce).to.equal(true);
  });

  for (const policy of [undefined, { ...consultationOperation, viewerAllowed: false }]) {
    it(`denies viewers before tokens/locks even if locking is exempt (${policy ? 'declared' : 'unclassified'})`, async () => {
      const access = sandbox.spy(FwCloud, 'getFwcloudAccess');
      const { app, token, downstream } = pipeline(UserRole.Viewer, policy);
      await request(app).post('/operation').send({}).expect(403, {
        fwcErr: 7013,
        msg: 'Read-only users cannot perform this operation',
      });
      expect(token.called).to.equal(false);
      expect(access.called).to.equal(false);
      expect(downstream.called).to.equal(false);
    });
  }

  it('honors independent confirmation requirements for a non-viewer', async () => {
    const { app, token, downstream } = pipeline(UserRole.Manager, {
      ...consultationOperation,
      viewerAllowed: false,
      requiresConfirmationToken: true,
    });
    await request(app).post('/operation').send({}).expect(403, { fwc_confirm_token: 'test-token' });
    expect(token.calledOnce).to.equal(true);
    expect(downstream.called).to.equal(false);
  });

  it('retains token behavior for a non-viewer on an unclassified operation', async () => {
    const { app, token } = pipeline(UserRole.Manager);
    await request(app).post('/operation').send({}).expect(403, { fwc_confirm_token: 'test-token' });
    expect(token.calledOnce).to.equal(true);
  });

  it('honors an explicit lock requirement even on GET and keeps existing ownership checks', async () => {
    const access = sandbox
      .stub(FwCloud, 'getFwcloudAccess')
      .resolves({ access: true, locked: true, mylock: true } as any);
    const next = sandbox.spy();
    await new LockValidation().handle(
      {
        method: 'GET',
        url: '/fwclouds/1/operation',
        body: {},
        session: { user_id: 7 },
        operationPolicy: {
          ...consultationOperation,
          viewerAllowed: false,
          requiresCloudLock: true,
        },
      } as any,
      {} as any,
      next,
    );
    expect(access.calledOnce).to.equal(true);
    expect(next.calledOnce).to.equal(true);
  });

  it('still rejects a writer when another session holds a required cloud lock', async () => {
    sandbox
      .stub(FwCloud, 'getFwcloudAccess')
      .resolves({ access: true, locked: true, mylock: false } as any);
    const next = sandbox.spy();
    const json = sandbox.spy();
    const response = { status: sandbox.stub().returns({ json }) };
    await new LockValidation().handle(
      {
        method: 'GET',
        url: '/fwclouds/1/operation',
        body: {},
        session: { user_id: 7 },
        operationPolicy: {
          ...consultationOperation,
          viewerAllowed: false,
          requiresCloudLock: true,
        },
      } as any,
      response as any,
      next,
    );
    expect(response.status.calledWith(403)).to.equal(true);
    expect(json.firstCall.args[0].fwcErr).to.equal(7012);
    expect(next.called).to.equal(false);
  });

  it('preserves the GET lock exemption for unclassified non-viewer routes', async () => {
    const access = sandbox.spy(FwCloud, 'getFwcloudAccess');
    const next = sandbox.spy();
    await new LockValidation().handle(
      { method: 'GET', url: '/legacy', body: {} } as any,
      {} as any,
      next,
    );
    expect(access.called).to.equal(false);
    expect(next.calledOnce).to.equal(true);
  });
});
