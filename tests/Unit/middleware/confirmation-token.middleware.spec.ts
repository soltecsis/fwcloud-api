import { expect } from 'chai';
import { Request, Response } from 'express';
import sinon from 'sinon';
import { HTTPApplication } from '../../../src/fonaments/http-application';
import { ConfirmationToken } from '../../../src/middleware/confirmation-token.middleware';

class TestConfirmationToken extends ConfirmationToken {
  constructor(enabled: boolean = true) {
    super();
    this.app = { config: { get: () => enabled } } as unknown as HTTPApplication;
  }
}

type StubResponse = Omit<Response, 'status' | 'json'> & {
  status: sinon.SinonStub;
  json: sinon.SinonStub;
};

describe('ConfirmationToken audit classification', () => {
  const createRequest = (token?: string): Request =>
    ({
      url: '/resource/delete',
      path: '/resource/delete',
      method: 'DELETE',
      headers: token === undefined ? {} : { 'x-fwc-confirm-token': token },
      sessionID: 'confirmation-session',
      session: {
        user: { confirmation_token: 'valid-token', save: sinon.stub().resolves() },
      },
    }) as unknown as Request;

  const createResponse = (): StubResponse =>
    ({
      locals: {},
      status: sinon.stub().returnsThis(),
      json: sinon.stub(),
    }) as unknown as StubResponse;

  for (const token of [undefined, 'invalid-token']) {
    it(`marks the challenge before sending the response for a ${token === undefined ? 'missing' : 'invalid'} token`, async () => {
      const req = createRequest(token);
      const res = createResponse();
      const next = sinon.spy();
      (res.json as sinon.SinonStub).callsFake((body) => {
        expect(res.locals.__auditLogConfirmationTokenChallenge).to.equal(true);
        expect(body.fwc_confirm_token).to.equal(req.session.user.confirmation_token);
        expect(body.fwc_confirm_token).to.match(/^confirmation-session_/);
      });

      await new TestConfirmationToken().handle(req, res, next);

      sinon.assert.calledOnceWithExactly(res.status as sinon.SinonStub, 403);
      sinon.assert.calledOnce(res.json as sinon.SinonStub);
      sinon.assert.calledOnce((req.session.user as unknown as { save: sinon.SinonStub }).save);
      sinon.assert.notCalled(next);
      expect(res.locals).to.deep.equal({ __auditLogConfirmationTokenChallenge: true });
    });
  }

  it('does not mark or regenerate a valid confirmation token', async () => {
    const req = createRequest('valid-token');
    const res = createResponse();
    const next = sinon.spy();

    await new TestConfirmationToken().handle(req, res, next);

    sinon.assert.calledOnce(next);
    sinon.assert.notCalled((req.session.user as unknown as { save: sinon.SinonStub }).save);
    sinon.assert.notCalled(res.status as sinon.SinonStub);
    expect(res.locals).to.not.have.property('__auditLogConfirmationTokenChallenge');
  });

  it('does not mark requests when confirmation tokens are disabled', async () => {
    const req = createRequest();
    const res = createResponse();
    const next = sinon.spy();

    await new TestConfirmationToken(false).handle(req, res, next);

    sinon.assert.calledOnce(next);
    sinon.assert.notCalled((req.session.user as unknown as { save: sinon.SinonStub }).save);
    expect(res.locals).to.not.have.property('__auditLogConfirmationTokenChallenge');
  });

  for (const [method, path] of [
    ['GET', '/resource'],
    ['POST', '/resource/get'],
  ]) {
    it(`does not mark exempt ${method} ${path} requests`, async () => {
      const req = createRequest();
      Object.assign(req, { method, path, url: path });
      const res = createResponse();
      const next = sinon.spy();

      await new TestConfirmationToken().handle(req, res, next);

      sinon.assert.calledOnce(next);
      sinon.assert.notCalled((req.session.user as unknown as { save: sinon.SinonStub }).save);
      expect(res.locals).to.not.have.property('__auditLogConfirmationTokenChallenge');
    });
  }

  it('does not mark a downstream HTTP 403 response after accepting a valid token', async () => {
    const req = createRequest('valid-token');
    const res = createResponse();

    await new TestConfirmationToken().handle(req, res, () => {
      res.status(403).json({ error: 'Permission denied' });
    });

    sinon.assert.calledOnceWithExactly(res.status as sinon.SinonStub, 403);
    expect(res.locals).to.not.have.property('__auditLogConfirmationTokenChallenge');
  });
});
