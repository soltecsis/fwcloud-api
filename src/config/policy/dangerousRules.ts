import dangerousRules from './dangerous-rules.json';

// Mapping of type to ipType and chain
const typeMap = {
  1: { ipType: 'IPv4', chain: 'INPUT' },
  2: { ipType: 'IPv4', chain: 'OUTPUT' },
  3: { ipType: 'IPv4', chain: 'FORWARD' },
  4: { ipType: 'IPv4', chain: 'SNAT' },
  5: { ipType: 'IPv4', chain: 'DNAT' },
  61: { ipType: 'IPv6', chain: 'INPUT' },
  62: { ipType: 'IPv6', chain: 'OUTPUT' },
  63: { ipType: 'IPv6', chain: 'FORWARD' },
  64: { ipType: 'IPv6', chain: 'SNAT' },
  65: { ipType: 'IPv6', chain: 'DNAT' },
};

type DangerousRuleInfo = {
  ruleIPType: 'IPv4' | 'IPv6';
  ruleChainType: 'INPUT' | 'OUTPUT' | 'FORWARD' | 'SNAT' | 'DNAT';
  ruleOrder: number;
};

export { typeMap, dangerousRules, DangerousRuleInfo };
