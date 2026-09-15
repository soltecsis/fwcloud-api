import { describeName, expect } from '../../../mocha/global-setup';
import {
  dereferenceParameter,
  getProfileParameters,
  isReplicationProfileParameterRef,
  parseReplicationProfileAddress,
  parseReplicationProfileNetwork,
  parseReplicationProfilePort,
  parseReplicationProfileService,
  ReplicationProfileParameterError,
  resolveParameterValues,
} from '../../../../src/models/replication-profile/replication-profile-parameters';

describe(describeName('Replication Profile Parameters Unit Tests'), () => {
  describe('getProfileParameters()', () => {
    it('should read declared parameters and infer optionality from the default', () => {
      const parameters = getProfileParameters({
        parameters: [
          { name: 'LAN_NET', type: 'network', label: 'LAN network' },
          { name: 'APP_PORT', type: 'port', default: 800 },
        ],
      });

      expect(parameters).to.have.length(2);
      expect(parameters[0].required).to.be.true;
      expect(parameters[1].required).to.be.false;
      expect(parameters[1].default).to.be.eq(800);
    });

    it('should drop malformed declarations and deduplicate by name', () => {
      const parameters = getProfileParameters({
        parameters: [
          { name: '1BAD', type: 'port' },
          { name: 'GOOD', type: 'nope' },
          { name: 'GOOD', type: 'port' },
          { name: 'GOOD', type: 'network' },
        ],
      });

      expect(parameters).to.have.length(1);
      expect(parameters[0].name).to.be.eq('GOOD');
      expect(parameters[0].type).to.be.eq('port');
    });

    it('should return an empty list when the model declares none', () => {
      expect(getProfileParameters({ provision: { interfaces: [] } })).to.be.empty;
      expect(getProfileParameters(null)).to.be.empty;
    });
  });

  describe('resolveParameterValues()', () => {
    const parameters = getProfileParameters({
      parameters: [
        { name: 'WAN_IP', type: 'address' },
        { name: 'APP_PORT', type: 'port', default: 800 },
      ],
    });

    it('should merge supplied values over declared defaults', () => {
      const values = resolveParameterValues(parameters, { WAN_IP: '1.2.3.4/24' });

      expect(values.get('WAN_IP')).to.be.eq('1.2.3.4/24');
      expect(values.get('APP_PORT')).to.be.eq(800);
    });

    it('should let a supplied value override the default', () => {
      const values = resolveParameterValues(parameters, { WAN_IP: '1.2.3.4', APP_PORT: 8443 });

      expect(values.get('APP_PORT')).to.be.eq(8443);
    });

    it('should reject a missing required parameter', () => {
      expect(() => resolveParameterValues(parameters, {})).to.throw(
        ReplicationProfileParameterError,
        /WAN_IP/,
      );
    });

    it('should reject a value for a parameter the profile never declared', () => {
      expect(() => resolveParameterValues(parameters, { WAN_IP: '1.2.3.4', NOPE: 1 })).to.throw(
        ReplicationProfileParameterError,
        /NOPE/,
      );
    });
  });

  describe('dereferenceParameter()', () => {
    it('should resolve a reference and pass literals through', () => {
      const values = new Map<string, unknown>([['APP_PORT', 800]]);

      expect(dereferenceParameter({ param: 'APP_PORT' }, values)).to.be.eq(800);
      expect(dereferenceParameter('tcp/443', values)).to.be.eq('tcp/443');
    });

    it('should return undefined for an unset optional parameter', () => {
      expect(dereferenceParameter({ param: 'MISSING' }, new Map())).to.be.undefined;
    });

    it('should recognize parameter references', () => {
      expect(isReplicationProfileParameterRef({ param: 'X' })).to.be.true;
      expect(isReplicationProfileParameterRef({ param: '  ' })).to.be.false;
      expect(isReplicationProfileParameterRef('X')).to.be.false;
    });
  });

  describe('value parsing', () => {
    it('should parse addresses with prefix, dotted mask and no mask', () => {
      expect(parseReplicationProfileAddress('10.0.0.1')).to.deep.eq({
        address: '10.0.0.1',
        netmask: '/32',
        ipVersion: 4,
      });
      expect(parseReplicationProfileAddress('10.0.0.1/24')).to.deep.eq({
        address: '10.0.0.1',
        netmask: '/24',
        ipVersion: 4,
      });
      expect(parseReplicationProfileAddress('10.0.0.1/255.255.255.0')).to.deep.eq({
        address: '10.0.0.1',
        netmask: '/24',
        ipVersion: 4,
      });
    });

    it('should normalize a network to its network address', () => {
      // Host bits set: two operators writing the same subnet differently must
      // still resolve to a single object.
      expect(parseReplicationProfileNetwork('192.168.1.37/24')).to.deep.eq({
        address: '192.168.1.0',
        netmask: '/24',
        ipVersion: 4,
      });
    });

    it('should reject values of the wrong family and malformed input', () => {
      expect(parseReplicationProfileAddress('10.0.0.1', 6)).to.be.null;
      expect(parseReplicationProfileAddress('999.0.0.1')).to.be.null;
      expect(parseReplicationProfileAddress('10.0.0.1/33')).to.be.null;
      expect(parseReplicationProfileAddress('')).to.be.null;
    });

    it('should parse IPv6 addresses', () => {
      expect(parseReplicationProfileAddress('fd00::1/64')).to.deep.eq({
        address: 'fd00::1',
        netmask: '/64',
        ipVersion: 6,
      });
    });

    it('should parse ports and services', () => {
      expect(parseReplicationProfilePort(800)).to.be.eq(800);
      expect(parseReplicationProfilePort('800')).to.be.eq(800);
      expect(parseReplicationProfilePort(0)).to.be.null;
      expect(parseReplicationProfilePort(70000)).to.be.null;

      expect(parseReplicationProfileService('tcp/800')).to.deep.eq({
        protocol: 'tcp',
        port: 800,
      });
      expect(parseReplicationProfileService({ protocol: 'udp', port: 53 })).to.deep.eq({
        protocol: 'udp',
        port: 53,
      });
      expect(parseReplicationProfileService('sctp/800')).to.be.null;
    });
  });
});
