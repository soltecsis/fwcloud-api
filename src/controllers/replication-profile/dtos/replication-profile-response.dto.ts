export interface ReplicationProfileResponseDto {
  id: number;
  code: string;
  version: number;
  name: string;
  description: string | null;
  scope: string;
  targetKind: string;
  model: Record<string, unknown>;
}
