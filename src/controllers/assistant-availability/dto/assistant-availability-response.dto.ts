import type { AssistedProfileHealthStatus } from '../../../communications/assistant-agent/assisted-profile-health.types';

/**
 * UI-facing availability payload. Deliberately excludes the agent URL, API
 * key, TLS configuration, and any raw upstream health error.
 */
export interface AssistantAvailabilityDto {
  available: boolean;
  busy: boolean;
  alive: boolean;
  modelReady: boolean;
  status: AssistedProfileHealthStatus;
  lastCheckedAt: string | null;
}
