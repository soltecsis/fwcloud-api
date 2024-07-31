export interface ConfigType {
  env: string;
  tmp: TmpConfig;
  maintenance_mode: boolean;
  api_server: ApiServerConfig;
  confirmation_token: boolean;
  CORS: CORSConfig;
  session: SessionConfig;
  db: DBConfig;
  crypt: CryptConfig;
  lock: LockConfig;
  policy: PolicyConfig;
  pki: PkiConfig;
  backup: BackupConfig;
  snapshot: SnapshotConfig;
  exporter: ExporterConfig;
  log: LogConfig;
  openvpn: OpenVPNConfig;
  updater: UpdaterConfig;
  ui: UIConfig;
  api: APIConfig;
  websrv: WebsrvConfig;
  socket_io: SocketIOConfig;
  limits: LimitsConfig;
  firewall_communication: FirewallCommunicationConfig;
}

// Interfaz para 'tmp'
export interface TmpConfig {
  directory: string;
}

// Interfaz para 'api_server'
export interface ApiServerConfig {
  enabled: boolean;
  https: boolean;
  ip: string;
  port: number;
  cert: string;
  key: string;
  ca_bundle: string;
}

// Interfaz para 'CORS'
export interface CORSConfig {
  enabled: boolean;
  whitelist: string[];
}

// Interfaz para 'session'
export interface SessionConfig {
  name: string;
  secret: string;
  force_HTTPS: boolean;
  keepalive_ms: number;
  files_path: string;
  pgp_rsa_bits: number;
}

// Interfaz para 'db'
export interface DBConfig {
  host: string;
  port: number;
  name: string;
  user: string;
  pass: string;
  connectionLimit: number;
  mode: string;
  commitMode: number;
  migrations: string[];
  migration_directory: string;
  mysqldump: MysqldumpConfig;
}

// Interfaz para 'mysqldump'
export interface MysqldumpConfig {
  protocol: string;
}

// Interfaz para 'crypt'
export interface CryptConfig {
  algorithm: string;
  secret: string;
}

// Interfaz para 'lock'
export interface LockConfig {
  check_interval_mls: number;
  unlock_timeout_min: number;
}

// Interfaz para 'policy'
export interface PolicyConfig {
  data_dir: string;
  script_name: string;
  script_dir: string;
  header_file: string;
  footer_file: string;
}

// Interfaz para 'pki'
export interface PkiConfig {
  data_dir: string;
  easy_rsa_cmd: string;
}

// Interfaz para 'backup'
export interface BackupConfig {
  data_dir: string;
  config_file: string;
  schedule: string;
  max_copies: number;
  max_days: number;
}

// Interfaz para 'snapshot'
export interface SnapshotConfig {
  data_dir: string;
}

// Interfaz para 'exporter'
export interface ExporterConfig {
  data_dir: string;
  upload_dir: string;
}

// Interfaz para 'log'
export interface LogConfig {
  level: string;
  queries: boolean;
  stdout: boolean;
  directory: string;
  maxFiles: number;
  maxSize: number;
}

// Interfaz para 'openvpn'
export interface OpenVPNConfig {
  installer: InstallerConfig;
  agent: AgentConfig;
  history: HistoryConfig;
}

// Interfaz para 'installer'
export interface InstallerConfig {
  osslsigncode: OsslsigncodeConfig;
}

// Interfaz para 'osslsigncode'
export interface OsslsigncodeConfig {
  path: string;
  cert_path: string;
  description: string;
  url: string;
}

// Interfaz para 'agent'
export interface AgentConfig {
  timeout: number;
  plugins_timeout: number;
  history: AgentHistoryConfig;
}

// Interfaz para 'history' en 'agent'
export interface AgentHistoryConfig {
  interval: number;
}

// Interfaz para 'history' en 'openvpn'
export interface HistoryConfig {
  data_dir: string;
  archive_schedule: string;
  retention_schedule: string;
  archive_days: number;
  retention_days: number;
}

// Interfaz para 'updater'
export interface UpdaterConfig {
  installDir: string;
  versionURL: string;
  url: string;
}

// Interfaz para 'ui'
export interface UIConfig {
  installDir: string;
  versionURL: string;
}

// Interfaz para 'api'
export interface APIConfig {
  installDir: string;
  versionURL: string;
}

// Interfaz para 'websrv'
export interface WebsrvConfig {
  installDir: string;
  versionURL: string;
}

// Interfaz para 'socket_io'
export interface SocketIOConfig {
  pingInterval: number;
  pingTimeout: number;
}

// Interfaz para 'limits'
export interface LimitsConfig {
  fwclouds: number;
  firewalls: number;
  clusters: number;
  nodes: number;
}

// Interfaz para 'firewall_communication'
export interface FirewallCommunicationConfig {
  ssh_enable: boolean;
}
