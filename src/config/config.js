/*
    Copyright 2025 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

const fs = require('fs');
process.env.NODE_ENV !== 'test' ? require('dotenv').config({ quiet: true }) : true;
const path = require('path');
var convict = require('convict');
convict.addFormat(require('convict-format-with-moment').duration);
convict.addFormat({
  name: 'positive-integer',
  validate: function(value) {
    if (!Number.isSafeInteger(value) || value <= 0 || value > 2147483647) {
      throw new Error('must be a positive integer no greater than 2147483647');
    }
  },
  coerce: function(value) {
    return Number(value);
  }
});
convict.addFormat({
  name: 'non-negative-integer',
  validate: function(value) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 2147483647) {
      throw new Error('must be a non-negative integer no greater than 2147483647');
    }
  },
  coerce: function(value) {
    if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
      return Number(value.trim());
    }
    return value;
  }
});

// Define a schema
const config = convict({
  env: {
    doc: 'The application environment.',
    format: ['prod', 'dev', 'test'],
    default: 'dev',
    env: 'NODE_ENV'
  },

  tmp: {
    directory: {
      doc: 'Temporal directory',
      format: String,
      default: './.tmp',
      env: 'TMP_DIRECTORY'
    }
  },

  maintenance_mode: {
    doc: 'Application maintenance mode',
    format: Boolean,
    default: false,
    env: "MAINTENANCE_MODE"
  },

  // Server for the API.
  api_server: {
    enabled: {
      doc: 'API server.',
      format: Boolean,
      default: true,
      env: 'APISRV_ENABLE'
    },
    https: {
      doc: 'Enable HTTPS protocol for the API server.',
      format: Boolean,
      default: true,
      env: 'APISRV_HTTPS'
    },
    ip: {
      doc: 'API IP address or hostname to bind.',
      format: String,
      default: '127.0.0.1',
      env: 'APISRV_IP'
    },
    port: {
      doc: 'API TCP port to bind.',
      format: 'port',
      default: 3131,
      env: 'APISRV_PORT'
    },
    cert: {
      doc: 'Path to certificate file.',
      format: String,
      default: './config/tls/fwcloud-api.crt',
      env: 'APISRV_HTTPS_CERT'
    },
    key: {
      doc: 'Path to key file.',
      format: String,
      default: './config/tls/fwcloud-api.key',
      env: 'APISRV_HTTPS_KEY'
    },
    ca_bundle: {
      doc: 'Path to CA bundle file.',
      format: String,
      default: '',
      env: 'APISRV_HTTPS_CA_BUNDLE'
    }
  },

  // Confirmation token for all not GET requests.
  confirmation_token: {
    doc: 'Confirmation token for all modification API requests.',
    format: Boolean,
    default: true,
    env: 'CONFIRMATION_TOKEN'
  },

  // CORS (Cross-Origin Resource Sharing) options.
  CORS: {
    enabled: {
      doc: 'Enable CORS (Cross-Origin Resource Sharing)',
      format: Boolean,
      default: true,
      env: 'CORS_ENABLED'
    },
    whitelist: {
      doc: 'CORS (Cross-Origin Resource Sharing) withelist.',
      format:  String,
      default: "",
      env: 'CORS_WHITELIST'
    },
  },

  // Session cookie configuration parameters.
	session: {
    name: {
      doc: 'Name of the session cookie.',
      format: String,
      default: 'FWCloud.net-cookie'
    },
    secret: {
      doc: 'Secret used for session cookies and CSRF (Cros-Site Rquest Forgery) tockens.',
      format: '*',
      default: '',
      env: 'SESSION_SECRET',
      sensitive: true
    },
    force_HTTPS: {
      doc: 'Force the use of HTTPS for session cookie.',
      format: Boolean,
      env: 'SESSION_FORCE_HTTPS',
      default: true
    },
    keepalive_ms: {
      doc: 'Amount of milliseconds that a session can remain active without any request.',
      format: 'duration',
      env: 'SESSION_KEEPALIVE_MS',
      default: 900*1000
    },
    files_path: {
      doc: 'Directory for the session cookies store.',
      format:  String,
      env: 'SESSION_FILES_PATH',
      default: './sessions'
    },
    pgp_rsa_bits: {
      doc: 'Bits for generate the RSA PGP keys pair.',
      format:  Number,
      env: 'SESSION_PGP_RSA_BITS',
      /* We can use 4096 bits, but with 2048 is enougth because requires less resources 
			and covers the funcionality of avoid sending sensible data like ssh username and
			password to the API without encryption. 
      
      WARNING: The more bits we use the longer it takes the login process.

			We must have in mind that in a production enviroment it is highly 
			advisable to use https secure communications and then sensible data already travels
			encripted.
			
			With the use of PGP for encrypt sensible data (mainly ssh username and passwords) 
			what we want is to do is add an additional security level and avoid that if the user looks 
			at the API calls generated in his we browser (for example, using the web developer tools) 
			he is able to see passwords in plain text in the body of the API requests. */    
      default: 2048
    }
	},

  // Database configuration.
  db: {
    host: {
      doc: 'Database host name or IP address.',
      format: String,
      default: '127.0.0.1',
      env: 'TYPEORM_HOST'
    },
    port: {
      doc: 'Database port',
      format: Number,
      default: 3306,
      env: 'TYPEORM_PORT'
    },
    name: {
      doc: 'Database name.',
      format: String,
      default: 'fwcloud',
      env: 'TYPEORM_DATABASE'
    },
    user: {
      doc: 'Database user.',
      format: String,
      default: 'fwcdbusr',
      env: 'TYPEORM_USERNAME'
    },
    pass: {
      doc: 'Database password.',
      format: String,
      default: '',
      env: 'TYPEORM_PASSWORD',
      sensitive: true
    },
    connectionLimit: {
      doc: 'Database maximun connections.',
      format: 'int',
      default: 100,
      env: 'TYPEORM_CONNECTION_LIMIT'
    },
    mode: {
      doc: 'Database mode.',
      format: String,
      default: 'mode_production',
      env: 'TYPEORM_MODE'
    },
    commitMode: {
      doc: 'Database commint mode.',
      format: 'int',
      default: 1,
      env: 'TYPEORM_COMMIT_MODE'
    },
    migrations: {
      doc: 'Database migration file pattern',
      format: Array,
      default: ['dist/src/database/migrations/**/*.js'],
      env: 'TYPEORM_MIGRATIONS'
    },
    migration_directory: {
      doc: 'Database migration directory',
      format: String,
      default: 'src/database/migrations',
      env: 'TYPEORM_MIGRATION_DIR'
    },
    mysqldump: {
      protocol: {
        doc: 'mysqldump connection protocol',
        format: ['tcp', 'socket'],
        default: 'socket',
      }
    }
  },

  // Encryption parameters.
	crypt: {
    algorithm: {
      doc: 'Encryption algorithm.',
      format: String,
      default: 'aes-256-ctr',
      env: 'CRYPT_ALGORITHM',
    },
    secret: {
      doc: 'Secret used for data encryption.',
      format: '*',
      default: '',
      env: 'CRYPT_SECRET',
      sensitive: true
    }
	},

  // Lock system configuration.
  lock : {
    check_interval_mls: {
      doc: 'Check interval in miliseconds.',
      format: 'duration',
      default: 60000,
      env: 'LOCK_CHECK_INTERVAL_MLS'
    },
    unlock_timeout_min: {
      doc: 'Automatic unlock in minutes.',
      format: 'duration',
      default: 15,
      env: 'LOCK_CHECK_INTERVAL_MIN'
    }
  },

  // Policy configuration.
  policy: {
    data_dir: {
      doc: 'Directory for the policy compilation scripts.',
      format: String,
      default: './DATA/policy/',
      env: 'POLICY_DATA_DIR'
    },
    script_name: {
      doc: 'Name for the script generated in the compilation process of a firewall.',
      format: String,
      default: 'fwcloud.sh',
      env: 'POLICY_SCRIPT_NAME'
    },
    script_dir: {
      doc: 'Destination directory for the FWCloud script.',
      format: String,
      default: '/etc/fwcloud/',
      env: 'POLICY_SCRIPT_DIR'
    },
    header_file: {
      doc: 'Header file for the compilation script.',
      format: String,
      default: './config/policy/header.txt'
    },
    footer_file: {
      doc: 'Footer file for the compilation script.',
      format: String,
      default: './config/policy/footer.txt'
    },
    dangerous_rules: {
      doc: 'File that contains dangerous rules that need confirmation.',
      format: String,
      default: './config/policy/dangerous_rules.json'
    },
    vyos_header_file: {
      doc: 'Header file for VyOS compilation scripts.',
      format: String,
      default: './config/policy/header_VyOS.txt'
    },
    vyos_footer_file: {
      doc: 'Footer file for VyOS compilation scripts.',
      format: String,
      default: './config/policy/footer_VyOS.txt'
    },
  },

  // PKI configuration.
  pki: {
    data_dir: {
      doc: 'Directory for the PKI files.',
      format: String,
      default: './DATA/pki/',
      env: 'PKI_DATA_DIR'
    },
    easy_rsa_cmd: {
      doc: 'Path to the easy-rsa command.',
      format: String,
      default: './lib/easy-rsa/easyrsa3/easyrsa',
    },
  },

  //IPSec configuration.
  ipsec: {
    data_dir: {
      doc: 'Directory for the IPSec files.',
      format: String,
      default: './DATA/ipsec/',
      env: 'IPSEC_DATA_DIR'
    },
  },

  // Backup configuration.
  backup: {
    data_dir: {
      doc: 'Directory for store the backups.',
      format: String,
      default: './BACKUP/',
      env: 'BACKUP_DATA_DIR'
    },
    config_file: {
      doc: 'File for store backup data (schedule and policy retention) in JSON format.',
      format: String,
      default: 'backup_config.json'
    },
    schedule: {
      doc: 'Default backup cron task schedule',
      format: String,
      default: '0 30 2 * * *'
    },
    max_copies: {
      doc: 'Default value for maximum copies retention policy. 0 means disabled.',
      format: Number,
      default: 0
    },
    max_days: {
      doc: 'Default value for maximum days retention policy. 0 means disabled.',
      format: Number,
      default: 30
    }
  },

  // Snapshot configuration.
  snapshot: {
    data_dir: {
      doc: 'Directory for store the snapshots.',
      format: String,
      default: './DATA/snapshots',
      env: 'SNAPSHOT_DATA_DIR'
    },
  },
  // FwCloud Exporter configuration.
  exporter: {
    data_dir: {
      doc: 'Directory for store the fwcloud files.',
      format: String,
      default: './DATA/EXPORTS',
      env: 'EXPORTER_DATA_DIR'
    },
    upload_dir: {
      doc: 'Directory for store uploaded fwcloud files',
      format: String,
      default: './DATA/EXPORTS/uploads',
      env: 'EXPORTER_UPLOAD_DIR'
    }
  },
  
  // Log configuration.
  log: {
    level: {
      doc: 'Log level',
      format: ['error', 'warn', 'info', 'verbose', 'debug', 'silly'],
      default: 'info',
      env: 'LOGS_LEVEL'
    },
    queries: {
      doc: 'Log queries',
      format: Boolean,
      default: false,
      env: 'LOG_QUERIES'
    },
    stdout: {
      doc: 'Broadcast logs to stdout',
      format: Boolean,
      default: false,
      env: 'LOG_STDOUT'
    },
    directory: {
      doc: 'Directory where the logs are stored',
      format: String,
      default: './logs',
      env: 'LOGS_DIRECTORY'
    },
    maxFiles: {
      doc: 'Maximum number of logs to keep',
      format: Number,
      default: 5,
      env: 'LOGS_MAXFILES'
    },
    maxSize: {
      doc: 'Maximum size of the file after which it will rotate',
      format: Number,
      default: 100000000,
      env: 'LOGS_MAXSIZE'
    }
  },

  auditLogs: {
    internal: {
      enabled: {
        doc: 'Enable persistence of internal audit events (workers, cron jobs and importers).',
        format: Boolean,
        default: false,
        env: 'AUDIT_LOG_INTERNAL_ENABLED'
      },
      cron: {
        enabled: {
          doc: 'Enable persistence of internal cron audit events.',
          format: Boolean,
          default: false,
          env: 'AUDIT_LOG_INTERNAL_CRON_ENABLED'
        }
      },
      worker: {
        enabled: {
          doc: 'Enable persistence of internal worker audit events.',
          format: Boolean,
          default: false,
          env: 'AUDIT_LOG_INTERNAL_WORKER_ENABLED'
        }
      },
      importer: {
        enabled: {
          doc: 'Enable persistence of internal importer audit events.',
          format: Boolean,
          default: false,
          env: 'AUDIT_LOG_INTERNAL_IMPORTER_ENABLED'
        }
      }
    },
    archive: {
      data_dir: {
        doc: 'Directory for storing audit log archive files.',
        format: String,
        default: './DATA/audit-logs/archive',
        env: 'AUDIT_LOG_ARCHIVE_DATA_DIR'
      },
      archive_schedule: {
        doc: 'Default archive cron task schedule for audit logs.',
        format: String,
        default: '0 30 2 * * *'
      },
      retention_schedule: {
        doc: 'Default remove archive files cron task schedule for audit logs.',
        format: String,
        default: '0 30 2 * * *'
      },
      archive_days: {
        doc: 'Date range for archive audit log entries.',
        format: Number,
        default: 180
      },
      retention_days: {
        doc: 'Retention period, in days, for audit log archive files.',
        format: Number,
        default: 720
      }
    }
  },

  // Assisted Profile fwcloud-ai-agent transport. The client performs the
  // remaining cross-field checks (required URL/key, HTTPS in production and
  // custom CA validation) when its singleton is initialized.
  assisted_profile: {
    enabled: {
      doc: 'Global opt-in for the Assisted Profile feature deployment. When false, assistant/drafts routes are unavailable and the agent health poller does not run, regardless of any other assisted_profile.* setting.',
      format: Boolean,
      default: false,
      env: 'ASSISTED_PROFILE_ENABLED'
    },
    agent: {
      url: {
        doc: 'Direct base URL of fwcloud-ai-agent. The client calls POST /generate.',
        format: String,
        default: '',
        env: 'ASSISTED_PROFILE_AGENT_URL'
      },
      api_key: {
        doc: 'Service key sent to fwcloud-ai-agent in X-API-Key.',
        format: String,
        default: '',
        env: 'ASSISTED_PROFILE_AGENT_API_KEY',
        sensitive: true
      },
      connect_timeout_ms: {
        doc: 'TCP/TLS connection-establishment timeout in milliseconds.',
        format: 'positive-integer',
        default: 10000,
        env: 'ASSISTED_PROFILE_AGENT_CONNECT_TIMEOUT_MS'
      },
      read_timeout_ms: {
        doc: 'Agent response timeout in milliseconds. Read timeouts are never retried.',
        format: 'positive-integer',
        default: 180000,
        env: 'ASSISTED_PROFILE_AGENT_READ_TIMEOUT_MS'
      },
      ca_file: {
        doc: 'Optional PEM CA file used to verify the fwcloud-ai-agent certificate.',
        format: String,
        default: '',
        env: 'ASSISTED_PROFILE_AGENT_CA_FILE'
      }
    },
    generation_queue: {
      max_depth: {
        doc: 'Maximum number of waiting Assisted Profile generations; excludes the active generation.',
        format: 'non-negative-integer',
        default: 3,
        env: 'ASSISTED_PROFILE_GENERATION_QUEUE_MAX_DEPTH'
      }
    },
    generation: {
      rate_limit: {
        max_requests: {
          doc: 'Maximum Assisted Profile generation requests a single user may submit within the rate-limit window.',
          format: 'positive-integer',
          default: 5,
          env: 'ASSISTED_PROFILE_GENERATION_RATE_LIMIT_MAX_REQUESTS'
        },
        window_ms: {
          doc: 'Rolling window, in milliseconds, over which max_requests is enforced per user.',
          format: 'positive-integer',
          default: 60000,
          env: 'ASSISTED_PROFILE_GENERATION_RATE_LIMIT_WINDOW_MS'
        }
      },
      clarification_ttl_ms: {
        doc: 'How long an ephemeral generation stays eligible to receive its one clarification answer before it is treated as expired.',
        format: 'positive-integer',
        default: 900000,
        env: 'ASSISTED_PROFILE_GENERATION_CLARIFICATION_TTL_MS'
      }
    },
    health: {
      poll_enabled: {
        doc: 'Enable periodic fwcloud-ai-agent health polling and the derived availability flag.',
        format: Boolean,
        default: true,
        env: 'ASSISTED_PROFILE_HEALTH_POLL_ENABLED'
      },
      poll_interval_ms: {
        doc: 'Delay between the end of one health check and the start of the next.',
        format: 'positive-integer',
        default: 30000,
        env: 'ASSISTED_PROFILE_HEALTH_POLL_INTERVAL_MS'
      },
      timeout_ms: {
        doc: 'Timeout in milliseconds for a single agent health request.',
        format: 'positive-integer',
        default: 5000,
        env: 'ASSISTED_PROFILE_HEALTH_TIMEOUT_MS'
      },
      path: {
        doc: 'Path of the agent health endpoint, relative to the agent base URL.',
        format: String,
        default: '/health',
        env: 'ASSISTED_PROFILE_HEALTH_PATH'
      }
    },
    draft: {
      ttl_seconds: {
        doc: 'Inactivity window (measured from updated_at) after which a non-terminal Assisted Profile draft becomes eligible for expiration.',
        format: 'positive-integer',
        default: 604800,
        env: 'ASSISTED_PROFILE_DRAFT_TTL_SECONDS'
      },
      expiration_job: {
        enabled: {
          doc: 'Enable the periodic job that expires inactive Assisted Profile drafts.',
          format: Boolean,
          default: true,
          env: 'ASSISTED_PROFILE_DRAFT_EXPIRATION_JOB_ENABLED'
        },
        interval_seconds: {
          doc: 'Delay between the end of one draft-expiration sweep and the start of the next.',
          format: 'positive-integer',
          default: 3600,
          env: 'ASSISTED_PROFILE_DRAFT_EXPIRATION_JOB_INTERVAL_SECONDS'
        },
        batch_size: {
          doc: 'Maximum number of drafts expired per sweep, to bound each run rather than scanning the whole table at once.',
          format: 'positive-integer',
          default: 100,
          env: 'ASSISTED_PROFILE_DRAFT_EXPIRATION_BATCH_SIZE'
        }
      }
    },
    idempotency: {
      ttl_seconds: {
        doc: 'TTL, in seconds, an Assisted Profile Idempotency-Key record stays bound to its payload hash and cached response before it is treated as a new key.',
        format: 'positive-integer',
        default: 86400,
        env: 'ASSISTED_PROFILE_IDEMPOTENCY_TTL_SECONDS'
      }
    },
    rejected_proposal_capture: {
      enabled: {
        doc: 'Opt-in, pilot-only capture of ANONYMIZED proposals rejected by Assisted Profile validation, for later evaluation of rejection patterns. Disabled by default; an absent setting behaves exactly as false. The raw rejected proposal is never persisted, and accepted proposals are never captured. See docs/assisted-profile-rejected-proposal-capture.md before enabling it.',
        format: Boolean,
        default: false,
        env: 'ASSISTED_PROFILE_CAPTURE_REJECTED_PROPOSALS'
      },
      retention_days: {
        doc: 'Retention window, in days, applied to every captured anonymized rejected proposal. Written into each record as expires_at at capture time. Never unlimited.',
        format: 'positive-integer',
        default: 14,
        env: 'ASSISTED_PROFILE_REJECTED_PROPOSAL_RETENTION_DAYS'
      },
      purge_job: {
        enabled: {
          doc: 'Enable the periodic job that physically deletes expired anonymized rejected proposals. Runs regardless of the capture flag so samples still age out after capture is switched off.',
          format: Boolean,
          default: true,
          env: 'ASSISTED_PROFILE_REJECTED_PROPOSAL_PURGE_JOB_ENABLED'
        },
        interval_seconds: {
          doc: 'Delay between the end of one rejected-proposal purge sweep and the start of the next.',
          format: 'positive-integer',
          default: 3600,
          env: 'ASSISTED_PROFILE_REJECTED_PROPOSAL_PURGE_INTERVAL_SECONDS'
        },
        batch_size: {
          doc: 'Maximum number of expired samples deleted per batch, to bound each purge sweep rather than deleting the whole backlog at once.',
          format: 'positive-integer',
          default: 500,
          env: 'ASSISTED_PROFILE_REJECTED_PROPOSAL_PURGE_BATCH_SIZE'
        }
      }
    }
  },

  // OpenVPN configuration
  openvpn: {
    installer: {
      osslsigncode: {
        path: {
          doc: 'osslsigncode bin path. If is null, it will look if is present in $PATH',
          format: "*",
          default: null,
          env: 'OSSLSIGNCODE_PATH'
        },
        cert_path: {
          doc: 'Cartificate path used to sign the executable',
          format: String,
          default: './config/tls/fwcloud-exec-sign.pfx',
          env: 'OSSLSIGNCODE_CERT_PATH'
        },
        description: {
          doc: 'Description',
          format: String,
          default: 'FWCloud-VPN',
          env: 'OSSLSIGNCODE_DESCRIPTION'
        },
        url: {
          doc: 'URL',
          format: String,
          default: 'https://fwcloud.net',
          env: 'OSSLSIGNCODE_URL'
        }
      }
    },
    agent: {
      timeout: {
        doc: 'Socket timeout in milliseconds. This will set the timeout after the socket is connected.',
        format: Number,
        default: 90000
      },
      plugins_timeout: {
        doc: 'Socket timeout in milliseconds for the FWCloud-Agent plugins API call. This will set the timeout after the socket is connected.',
        format: Number,
        default: 300000
      },
      history: {
        interval: {
          doc: 'Interval, in minutes, to retrieve history data from the agent',
          format: Number,
          default: 5
        }
      }
    },
    history: {
      data_dir: {
        doc: 'Directory for store history archives.',
        format: String,
        default: './DATA/archive/openvpn/history',
        env: 'HISTORY_DATA_DIR'
      },
      archive_schedule: {
        doc: 'Default archive cron task schedule',
        format: String,
        default: '0 30 2 * * *'
      },
      retention_schedule: {
        doc: 'Default remove archive files cron task schedule',
        format: String,
        default: '0 30 2 * * *'
      },
      archive_days: {
        doc: 'Date range for archive an entry.',
        format: Number,
        default: 180
      },
      retention_days: {
        doc: 'Days for archive files retention policy.',
        format: Number,
        default: 720
      },
    }
  },

  // fwcloud-updater
  updater: {
    installDir: {
      doc: 'fwcloud-updater install directory',
      format: String,
      default: '/opt/fwcloud/updater',
      env: 'FWC_UPDATER_INSTALL_DIR'
    },
    versionURL: {
      doc: 'fwcloud-updater version URL',
      format: String,
      default: 'https://raw.githubusercontent.com/soltecsis/fwcloud-updater',
      env: 'FWC_UPDATER_VERSION_URL'
    },
    url: {
      doc: 'fwcloud-updater URL.',
      format: String,
      default: 'https://127.0.0.1:3132',
      env: 'FWC_UPDATER_URL'
    },
  },

  // fwcloud-ui
  ui: {
    installDir: {
      doc: 'fwcloud-ui install directory',
      format: String,
      default: '/opt/fwcloud/ui',
      env: 'FWC_UI_INSTALL_DIR'
    },
    versionURL: {
      doc: 'fwcloud-ui version URL',
      format: String,
      default: 'https://raw.githubusercontent.com/soltecsis/fwcloud-ui',
      env: 'FWC_UI_VERSION_URL'
    },
  },
  
  // fwcloud-api
  api: {
    installDir: {
      doc: 'fwcloud-api install directory',
      format: String,
      default: '/opt/fwcloud/api',
      env: 'FWC_API_INSTALL_DIR'
    },
    versionURL: {
      doc: 'fwcloud-api version URL',
      format: String,
      default: 'https://raw.githubusercontent.com/soltecsis/fwcloud-api',
      env: 'FWC_API_VERSION_URL'
    },
  },

  // fwcloud-websrv
  websrv: {
    installDir: {
      doc: 'fwcloud-websrv install directory',
      format: String,
      default: '/opt/fwcloud/websrv',
      env: 'FWC_WEBSRV_INSTALL_DIR'
    },
    versionURL: {
      doc: 'fwcloud-websrv version URL',
      format: String,
      default: 'https://raw.githubusercontent.com/soltecsis/fwcloud-websrv',
      env: 'FWC_WEBSRV_VERSION_URL'
    },
  },

  // socket.io 
  socket_io: {
    pingInterval: {
      doc: 'How many ms before sending a new ping packet.',
      format: Number,
      default: 600000,
      env: 'SOCKET_IO_PING_INTERVAL'
    },
    pingTimeout: {
      doc: 'How many ms without a pong packet to consider the connection closed.',
      format: Number,
      default: 300000,
      env: 'SOCKET_IO_PING_TIMEOUT'
    },
  },
  limits: {
    fwclouds: {
      doc: 'Limit number of fwclouds that a user can create at most.',
      format: Number,
      env: 'LIMIT_FWCLOUDS',
      default: 0
    },
    firewalls: {
      doc: 'Limit number of firewalls that a user can create at most.',
      format: Number,
      env: 'LIMIT_FIREWALLS',
      default: 0
    },
    clusters: {
      doc: 'Limit number of clusters that a user can create at most.',
      format: Number,
      env: 'LIMIT_CLUSTERS',
      default: 0
    },
    nodes: {
      doc: 'Limit number of nodes within a cluster that a user can create at most.',
      format: Number,
      env: 'LIMIT_NODES',
      default: 0
    }
  },
  firewall_communication:{
    ssh_enable: {
      doc: 'SSH communication flag',
      format: Boolean,
      env: 'SSH_COMMUNICATION_ENABLED',
      default: true
    }
  },
  //FwCloud - OpenAI Assistant
  openai_assistant: {
    openai: {
      apiKey: {
        doc: 'OpenAI API Key',
        format: String,
        default: '',
        env: 'OPENAI_API_KEY'
      },
      organization:{
        doc: 'OpenAI API Key Organization',
        format: String,
        default: '',
        env: 'OPENAI_ORGANIZATION'
      }
    }
  }
});


// Perform validation
try {
  config.loadFile(path.join('config/', `${config.get('env')}.json`));
  config.validate({allowed: 'strict'});
} catch(err) {
  console.log("Configuration "+err);
  process.exit();
}

module.exports = config;
