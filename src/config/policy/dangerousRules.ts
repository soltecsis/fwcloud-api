import dangerousRules from './dangerous-rules.json';

// Mapping of type to ipType and chain
const typeMap = {
  1: { ipType: 'ipv4', chain: 'INPUT' },
  2: { ipType: 'ipv4', chain: 'OUTPUT' },
  3: { ipType: 'ipv4', chain: 'FORWARD' },
  4: { ipType: 'ipv4', chain: 'SNAT' },
  5: { ipType: 'ipv4', chain: 'DNAT' },
  61: { ipType: 'ipv6', chain: 'INPUT' },
  62: { ipType: 'ipv6', chain: 'OUTPUT' },
  63: { ipType: 'ipv6', chain: 'FORWARD' },
  64: { ipType: 'ipv6', chain: 'SNAT' },
  65: { ipType: 'ipv6', chain: 'DNAT' },
};

type DangerousRuleInfo = {
  ruleIPType: 'ipv4' | 'ipv6';
  ruleChainType: 'INPUT' | 'OUTPUT' | 'FORWARD' | 'SNAT' | 'DNAT';
  ruleOrder: number;
};

export { typeMap, dangerousRules, DangerousRuleInfo };
