export interface ReplicationProfileTemplateErrorDto {
  reason: string;
  message: string;
}

export interface ReplicationProfileResponseDto {
  id: number;
  code: string;
  version: number;
  name: string;
  description: string | null;
  scope: string;
  category: string | null;
  targetKind: string;
  /** Loaded from the profile template; null when that template could not be read. */
  model: Record<string, unknown> | null;
  /** Why the template could not be read: the profile is still listed, marked, but unusable. */
  templateError: ReplicationProfileTemplateErrorDto | null;
  isBuiltin: boolean;
  isCustom: boolean;
  isActive: boolean;
  isDeprecated: boolean;
  /** Owner of a custom profile, who can use it from any of their FWClouds; null for built-in ones. */
  userId: number | null;
  /** FWCloud a custom profile was created from; null once that FWCloud is removed. */
  fwcloudId: number | null;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  is_built_in: boolean;
  is_active: boolean;
  is_deprecated: boolean;
  fwcloud_id: number | null;
  user_id: number | null;
}
