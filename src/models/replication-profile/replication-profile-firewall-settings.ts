/** Portable configuration using the native firewall bitmasks. Omitted fields retain
 * the destination's behavior for templates saved before global settings were captured. */
export interface ReplicationProfileFirewallMasks {
  options?: number;
  plugins?: number;
}

export interface ReplicationProfileFirewallSettings extends ReplicationProfileFirewallMasks {
  /** A cluster stores plugins on the cluster itself and both masks on each node. */
  nodes?: Record<string, ReplicationProfileFirewallMasks>;
}
