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
  fwcloudId: number | null;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
  is_built_in: boolean;
  is_active: boolean;
  is_deprecated: boolean;
  fwcloud_id: number | null;
}
