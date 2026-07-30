import type { AssistedProfileHealthStatus } from '../../../communications/assistant-agent/assisted-profile-health.types';

/**
 * UI-facing availability payload. Deliberately excludes the agent URL, API
 * key, TLS configuration, and any raw upstream health error.
 */
export interface AssistantAvailabilityDto {
  deploymentEnabled: boolean;
  available: boolean;
  busy: boolean;
  alive: boolean;
  modelReady: boolean;
  // 'disabled' is added here, on top of the runtime statuses
  // AssistedProfileHealthService can produce, because it reflects the global
  // deployment opt-in rather than a runtime health outcome.
  status: AssistedProfileHealthStatus | 'disabled';
  lastCheckedAt: string | null;
}
