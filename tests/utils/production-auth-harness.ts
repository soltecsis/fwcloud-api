import sinon = require('sinon');
import { Authorization } from '../../src/middleware/Authorization';
import { AuthorizationTest } from '../../src/middleware/AuthorizationTest';
import { expect, testSuite } from '../mocha/global-setup';

/** Run the production authentication handler with the existing test app/session store. */
export function useProductionAuthentication(): void {
  let sandbox: sinon.SinonSandbox;
  let handler: sinon.SinonSpy;
  let confirmationToken: boolean;

  beforeEach(() => {
    if (testSuite.app.config.get('env') !== 'test') {
      throw new Error('The security suite must run with test configuration.');
    }
    confirmationToken = testSuite.app.config.get('confirmation_token');
    sandbox = sinon.createSandbox();
    handler = sandbox.spy(Authorization.prototype, 'handle');
    // Middleware.register resolves this.handle on each request, preserving its app context.
    sandbox.stub(AuthorizationTest.prototype, 'handle').callsFake(function (req, res, next) {
      return Authorization.prototype.handle.call(this, req, res, next);
    });
  });

  afterEach(function () {
    const called = handler?.called;
    sandbox?.restore();
    testSuite.app.config.set('confirmation_token', confirmationToken);
    if (this.currentTest?.state === 'passed') {
      expect(called, 'production Authorization must process the security requests').to.eq(true);
    }
  });

  after(async () => {
    await testSuite.resetDatabaseData();
  });
}
