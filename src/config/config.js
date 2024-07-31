/*
    Copyright 2022 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

process.env.NODE_ENV !== 'test' ? require('dotenv').config() : true;
const path = require('path');
var convict = require('convict');
convict.addFormat(require('convict-format-with-moment').duration);

const config = convict({
  env: {
    doc: 'The application environment.',
    format: ['prod', 'dev', 'test'],
    default: 'dev',
    env: 'NODE_ENV',
  },

  tmp: {
    directory: {
      doc: 'Temporal directory',
      format: String,
      default: './.tmp',
      env: 'TMP_DIRECTORY',
    },
  },

  maintenance_mode: {
    doc: 'Application maintenance mode',
    format: Boolean,
    default: false,
    env: 'MAINTENANCE_MODE',
  },

  // Server for the API.
  api_server: {
    enabled: {
      doc: 'API server.',
      format: Boolean,
      default: true,
      env: 'APISRV_ENABLE',
    },
    https: {
      doc: 'Enable HTTPS protocol for the API server.',
      format: Boolean,
      default: true,
      env: 'APISRV_HTTPS',
    },
    ip: {
      doc: 'API IP address or hostname to bind.',
      format: String,
      default: 'localhost',
      env: 'APISRV_IP',
    },
    port: {
      doc: 'API TCP port to bind.',
      format: 'port',
      default: 3131,
      env: 'APISRV_PORT',
    },
    cert: {
      doc: 'Path to certificate file.',
      format: String,
      default: './config/tls/fwcloud-api.crt',
      env: 'APISRV_HTTPS_CERT',
    },
    key: {
      doc: 'Path to key file.',
      format: String,
      default: './config/tls/fwcloud-api.key',
      env: 'APISRV_HTTPS_KEY',
    },
    ca_bundle: {
      doc: 'Path to CA bundle file.',
      format: String,
      default: '',
      env: 'APISRV_HTTPS_CA_BUNDLE',
    },
  },

  // Confirmation token for all not GET requests.
  confirmation_token: {
    doc: 'Confirmation token for all modification API requests.',
    format: Boolean,
    default: true,
    env: 'CONFIRMATION_TOKEN',
  },

  // CORS (Cross-Origin Resource Sharing) options.
  CORS: {
    enabled: {
      doc: 'Enable CORS (Cross-Origin Resource Sharing)',
      format: Boolean,
      default: true,
      env: 'CORS_ENABLED',
    },
    whitelist: {
      doc: 'CORS (Cross-Origin Resource Sharing) withelist.',
      format: Array,
      default: [],
      env: 'CORS_WHITELIST',
    },
  },

  // Session cookie configuration parameters.
  session: {
    name: {
      doc: 'Name of the session cookie.',
      format: String,
      default: 'FWCloud.net-cookie',
    },
    secret: {
      doc: 'Secret used for session cookies and CSRF (Cros-Site Rquest Forgery) tockens.',
      format: '*',
      default: '',
      env: 'SESSION_SECRET',
      sensitive: true,
    },
    force_HTTPS: {
      doc: 'Force the use of HTTPS for session cookie.',
      format: Boolean,
      env: 'SESSION_FORCE_HTTPS',
      default: true,
    },
    keepalive_ms: {
      doc: 'Amount of milliseconds that a session can remain active without any request.',
      format: 'duration',
      env: 'SESSION_KEEPALIVE_MS',
      default: 900 * 1000,
    },
    files_path: {
      doc: 'Directory for the session cookies store.',
      format: String,
      env: 'SESSION_FILES_PATH',
      default: './sessions',
    },
    pgp_rsa_bits: {
      doc: 'Bits for generate the RSA PGP keys pair.',
      format: Number,
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
      default: 2048,
    },
  },

  // Database configuration.
  db: {
    host: {
      doc: 'Database host name or IP address.',
      format: String,
      default: 'localhost',
      env: 'TYPEORM_HOST',
    },
    port: {
      doc: 'Database port',
      format: Number,
      default: 3306,
      env: 'TYPEORM_PORT',
    },
    name: {
      doc: 'Database name.',
      format: String,
      default: 'fwcloud',
      env: 'TYPEORM_DATABASE',
    },
    user: {
      doc: 'Database user.',
      format: String,
      default: 'fwcdbusr',
      env: 'TYPEORM_USERNAME',
    },
    pass: {
      doc: 'Database password.',
      format: String,
      default: '',
      env: 'TYPEORM_PASSWORD',
      sensitive: true,
    },
    connectionLimit: {
      doc: 'Database maximun connections.',
      format: 'int',
      default: 100,
      env: 'TYPEORM_CONNECTION_LIMIT',
    },
    mode: {
      doc: 'Database mode.',
      format: String,
      default: 'mode_production',
      env: 'TYPEORM_MODE',
    },
    commitMode: {
      doc: 'Database commint mode.',
      format: 'int',
      default: 1,
      env: 'TYPEORM_COMMIT_MODE',
    },
    migrations: {
      doc: 'Database migration file pattern',
      format: Array,
      default: ['dist/src/database/migrations/**/*.js'],
      env: 'TYPEORM_MIGRATIONS',
    },
    migration_directory: {
      doc: 'Database migration directory',
      format: String,
      default: 'src/database/migrations',
      env: 'TYPEORM_MIGRATION_DIR',
    },
    mysqldump: {
      protocol: {
        doc: 'mysqldump connection protocol',
        format: ['tcp', 'socket'],
        default: 'socket',
      },
    },
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
      sensitive: true,
    },
  },

  // Lock system configuration.
  lock: {
    check_interval_mls: {
      doc: 'Check interval in miliseconds.',
      format: 'duration',
      default: 60000,
      env: 'LOCK_CHECK_INTERVAL_MLS',
    },
    unlock_timeout_min: {
      doc: 'Automatic unlock in minutes.',
      format: 'duration',
      default: 15,
      env: 'LOCK_CHECK_INTERVAL_MIN',
    },
  },

  // Policy configuration.
  policy: {
    data_dir: {
      doc: 'Directory for the policy compilation scripts.',
      format: String,
      default: './DATA/policy/',
      env: 'POLICY_DATA_DIR',
    },
    script_name: {
      doc: 'Name for the script generated in the compilation process of a firewall.',
      format: String,
      default: 'fwcloud.sh',
      env: 'POLICY_SCRIPT_NAME',
    },
    script_dir: {
      doc: 'Destination directory for the FWCloud script.',
      format: String,
      default: '/etc/fwcloud/',
      env: 'POLICY_SCRIPT_DIR',
    },
    header_file: {
      doc: 'Header file for the compilation script.',
      format: String,
      default: './config/policy/header.txt',
    },
    footer_file: {
      doc: 'Footer file for the compilation script.',
      format: String,
      default: './config/policy/footer.txt',
    },
  },

  // PKI configuration.
  pki: {
    data_dir: {
      doc: 'Directory for the PKI files.',
      format: String,
      default: './DATA/pki/',
      env: 'PKI_DATA_DIR',
    },
    easy_rsa_cmd: {
      doc: 'Path to the easy-rsa command.',
      format: String,
      default: './lib/easy-rsa/easyrsa3/easyrsa',
    },
  },

  // Backup configuration.
  backup: {
    data_dir: {
      doc: 'Directory for store the backups.',
      format: String,
      default: './BACKUP/',
      env: 'BACKUP_DATA_DIR',
    },
    config_file: {
      doc: 'File for store backup data (schedule and policy retention) in JSON format.',
      format: String,
      default: 'backup_config.json',
    },
    schedule: {
      doc: 'Default backup cron task schedule',
      format: String,
      default: '0 30 2 * * *',
    },
    max_copies: {
      doc: 'Default value for maximum copies retention policy. 0 means disabled.',
      format: Number,
      default: 0,
    },
    max_days: {
      doc: 'Default value for maximum days retention policy. 0 means disabled.',
      format: Number,
      default: 30,
    },
  },

  // Snapshot configuration.
  snapshot: {
    data_dir: {
      doc: 'Directory for store the snapshots.',
      format: String,
      default: './DATA/snapshots',
      env: 'SNAPSHOT_DATA_DIR',
    },
  },
  // FwCloud Exporter configuration.
  exporter: {
    data_dir: {
      doc: 'Directory for store the fwcloud files.',
      format: String,
      default: './DATA/EXPORTS',
      env: 'EXPORTER_DATA_DIR',
    },
    upload_dir: {
      doc: 'Directory for store uploaded fwcloud files',
      format: String,
      default: './DATA/EXPORTS/uploads',
      env: 'EXPORTER_UPLOAD_DIR',
    },
  },

  // Log configuration.
  log: {
    level: {
      doc: 'Log level',
      format: ['error', 'warn', 'info', 'verbose', 'debug', 'silly'],
      default: 'info',
      env: 'LOGS_LEVEL',
    },
    queries: {
      doc: 'Log queries',
      format: Boolean,
      default: false,
      env: 'LOG_QUERIES',
    },
    stdout: {
      doc: 'Broadcast logs to stdout',
      format: Boolean,
      default: false,
      env: 'LOG_STDOUT',
    },
    directory: {
      doc: 'Directory where the logs are stored',
      format: String,
      default: './logs',
      env: 'LOGS_DIRECTORY',
    },
    maxFiles: {
      doc: 'Maximum number of logs to keep',
      format: Number,
      default: 5,
      env: 'LOGS_MAXFILES',
    },
    maxSize: {
      doc: 'Maximum size of the file after which it will rotate',
      format: Number,
      default: 100000000,
      env: 'LOGS_MAXSIZE',
    },
  },

  // OpenVPN configuration
  openvpn: {
    installer: {
      osslsigncode: {
        path: {
          doc: 'osslsigncode bin path. If is null, it will look if is present in $PATH',
          format: '*',
          default: null,
          env: 'OSSLSIGNCODE_PATH',
        },
        cert_path: {
          doc: 'Cartificate path used to sign the executable',
          format: String,
          default: './config/tls/fwcloud-exec-sign.pfx',
          env: 'OSSLSIGNCODE_CERT_PATH',
        },
        description: {
          doc: 'Description',
          format: String,
          default: 'FWCloud-VPN',
          env: 'OSSLSIGNCODE_DESCRIPTION',
        },
        url: {
          doc: 'URL',
          format: String,
          default: 'https://fwcloud.net',
          env: 'OSSLSIGNCODE_URL',
        },
      },
    },
    agent: {
      timeout: {
        doc: 'Socket timeout in milliseconds. This will set the timeout after the socket is connected.',
        format: Number,
        default: 90000,
      },
      plugins_timeout: {
        doc: 'Socket timeout in milliseconds for the FWCloud-Agent plugins API call. This will set the timeout after the socket is connected.',
        format: Number,
        default: 300000,
      },
      history: {
        interval: {
          doc: 'Interval, in minutes, to retrieve history data from the agent',
          format: Number,
          default: 5,
        },
      },
    },
    history: {
      data_dir: {
        doc: 'Directory for store history archives.',
        format: String,
        default: './DATA/archive/openvpn/history',
        env: 'HISTORY_DATA_DIR',
      },
      archive_schedule: {
        doc: 'Default archive cron task schedule',
        format: String,
        default: '0 30 2 * * *',
      },
      retention_schedule: {
        doc: 'Default remove archive files cron task schedule',
        format: String,
        default: '0 30 2 * * *',
      },
      archive_days: {
        doc: 'Date range for archive an entry.',
        format: Number,
        default: 180,
      },
      retention_days: {
        doc: 'Days for archive files retention policy.',
        format: Number,
        default: 720,
      },
    },
  },

  // fwcloud-updater
  updater: {
    installDir: {
      doc: 'fwcloud-updater install directory',
      format: String,
      default: '/opt/fwcloud/updater',
      env: 'FWC_UPDATER_INSTALL_DIR',
    },
    versionURL: {
      doc: 'fwcloud-updater version URL',
      format: String,
      default: 'https://raw.githubusercontent.com/soltecsis/fwcloud-updater',
      env: 'FWC_UPDATER_VERSION_URL',
    },
    url: {
      doc: 'fwcloud-updater URL.',
      format: String,
      default: 'https://localhost:3132',
      env: 'FWC_UPDATER_URL',
    },
  },

  // fwcloud-ui
  ui: {
    installDir: {
      doc: 'fwcloud-ui install directory',
      format: String,
      default: '/opt/fwcloud/ui',
      env: 'FWC_UI_INSTALL_DIR',
    },
    versionURL: {
      doc: 'fwcloud-ui version URL',
      format: String,
      default: 'https://raw.githubusercontent.com/soltecsis/fwcloud-ui',
      env: 'FWC_UI_VERSION_URL',
    },
  },

  // fwcloud-api
  api: {
    installDir: {
      doc: 'fwcloud-api install directory',
      format: String,
      default: '/opt/fwcloud/api',
      env: 'FWC_API_INSTALL_DIR',
    },
    versionURL: {
      doc: 'fwcloud-api version URL',
      format: String,
      default: 'https://raw.githubusercontent.com/soltecsis/fwcloud-api',
      env: 'FWC_API_VERSION_URL',
    },
  },

  // fwcloud-websrv
  websrv: {
    installDir: {
      doc: 'fwcloud-websrv install directory',
      format: String,
      default: '/opt/fwcloud/websrv',
      env: 'FWC_WEBSRV_INSTALL_DIR',
    },
    versionURL: {
      doc: 'fwcloud-websrv version URL',
      format: String,
      default: 'https://raw.githubusercontent.com/soltecsis/fwcloud-websrv',
      env: 'FWC_WEBSRV_VERSION_URL',
    },
  },

  // socket.io
  socket_io: {
    pingInterval: {
      doc: 'How many ms before sending a new ping packet.',
      format: Number,
      default: 600000,
      env: 'SOCKET_IO_PING_INTERVAL',
    },
    pingTimeout: {
      doc: 'How many ms without a pong packet to consider the connection closed.',
      format: Number,
      default: 300000,
      env: 'SOCKET_IO_PING_TIMEOUT',
    },
  },
  limits: {
    fwclouds: {
      doc: 'Limit number of fwclouds that a user can create at most.',
      format: Number,
      env: 'LIMIT_FWCLOUDS',
      default: 0,
    },
    firewalls: {
      doc: 'Limit number of firewalls that a user can create at most.',
      format: Number,
      env: 'LIMIT_FIREWALLS',
      default: 0,
    },
    clusters: {
      doc: 'Limit number of clusters that a user can create at most.',
      format: Number,
      env: 'LIMIT_CLUSTERS',
      default: 0,
    },
    nodes: {
      doc: 'Limit number of nodes within a cluster that a user can create at most.',
      format: Number,
      env: 'LIMIT_NODES',
      default: 0,
    },
  },
  firewall_communication: {
    ssh_enable: {
      doc: 'SSH communication flag',
      format: Boolean,
      env: 'SSH_COMMUNICATION_ENABLED',
      default: true,
    },
  },
});

// Perform validation
try {
  config.loadFile(path.join('config/', `${config.get('env')}.json`));
  config.validate({ allowed: 'strict' });
} catch (err) {
  console.log('Configuration ' + err);
  process.exit();
}

module.exports = config;
