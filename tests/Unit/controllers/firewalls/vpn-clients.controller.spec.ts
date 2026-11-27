import assert from 'node:assert/strict';
import sinon from 'sinon';
import { Request } from 'express';
import db from '../../../../src/database/database-manager';
import { VPNClientsController } from '../../../../src/controllers/firewalls/vpn-clients.controller';
import { ResponseBuilder } from '../../../../src/fonaments/http/response-builder';

describe('VPN client download authorization', () => {
  afterEach(() => sinon.restore());

  function setup(role: number, fwClouds: { id: number }[]) {
    const query = sinon.stub();
    query.onCall(0).resolves([{ id: 10, name: 'server' }]);
    query.onCall(1).resolves([]);
    query.onCall(2).resolves([]);
    sinon.stub(db, 'getSource').returns({
      query,
      manager: {
        getRepository: () => ({ findOneOrFail: async () => ({ role, fwClouds }) }),
      },
    } as any);
    const response = {
      status: sinon.stub().returnsThis(),
      downloadContent: sinon.stub().returnsThis(),
    };
    sinon.stub(ResponseBuilder, 'buildResponse').returns(response as any);
    return { query, response, controller: new VPNClientsController(null) };
  }

  function request(protocol = 'openvpn', server = '10'): Request {
    return {
      params: { fwcloud: '1', firewall: '2', [protocol]: server },
      session: { user: { id: 5 } },
    } as unknown as Request;
  }

  it('denies users outside the FWCloud before reading VPN data', async () => {
    const { controller, query } = setup(0, [{ id: 99 }]);
    await assert.rejects(controller.download(request()), (error: any) => error.status === 401);
    sinon.assert.notCalled(query);
  });

  for (const protocol of ['openvpn', 'wireguard', 'ipsec']) {
    it(`${protocol}: allows members and downloads a CSV attachment`, async () => {
      const { controller, response } = setup(0, [{ id: 1 }]);
      await controller.download(request(protocol));
      sinon.assert.calledWithExactly(response.status, 200);
      const [content, filename, contentType] = response.downloadContent.firstCall.args;
      assert.equal(content, '\uFEFF"Cliente";"IP asociada";"Grupos"\r\n');
      assert.equal(filename, `server-clients(${protocol}).csv`);
      assert.equal(contentType, 'text/csv; charset=utf-8');
    });
  }

  it('downloads client names, addresses and group names as CSV rows', async () => {
    const { controller, response, query } = setup(1, []);
    query.onCall(1).resolves([
      { id: 11, name: 'Oficina', address: '10.0.0.2', group_id: 3, group_name: 'Personal' },
      { id: 12, name: 'Invitado', address: null, group_id: null, group_name: null },
    ]);
    await controller.download(request());
    assert.equal(
      response.downloadContent.firstCall.args[0],
      '\uFEFF"Cliente";"IP asociada";"Grupos"\r\n' +
        '"Oficina";"10.0.0.2";"Personal"\r\n' +
        '"Invitado";"";""\r\n',
    );
  });

  it('allows administrators without FWCloud membership', async () => {
    const { controller, response } = setup(1, []);
    await controller.download(request());
    sinon.assert.calledOnce(response.downloadContent);
  });

  it('rejects malformed identifiers without querying', async () => {
    const { controller, query } = setup(1, []);
    await assert.rejects(
      controller.download(request('openvpn', '10bad')),
      (error: any) => error.status === 404,
    );
    sinon.assert.notCalled(query);
  });
});
