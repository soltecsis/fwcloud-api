export interface ReplicationProfileResponseDto {
  id: number;
  code: string;
  version: number;
  name: string;
  description: string | null;
  scope: string;
  category: string | null;
  targetKind: string;
  model: Record<string, unknown>;
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
