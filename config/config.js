/*
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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


require('dotenv').config();
var convict = require('convict');

// Define a schema
const config = convict({
  env: {
    doc: 'The application environment.',
    format: ['prod', 'dev'],
    default: 'dev',
    env: 'NODE_ENV'
  },

  // Server bind parameters.
  listen: {
    ip: {
      doc: 'The IP address to bind.',
      format: 'ipaddress',
      default: '0.0.0.0',
      env: 'LISTEN_IP'
    },
    port: {
      doc: 'The port to bind.',
      format: 'port',
      default: 3000,
      env: 'LISTEN_PORT'
    }
  },

  // Confirmation token for all not GET requests.
  confirmation_token: {
    doc: 'Confirmation token for all modification API requests.',
    format: Boolean,
    default: true,
    env: 'CONFIRMATION_TOKEN'
  },

  // HTTPS settings for communicate with the API.
  https: {
    enable: {
      doc: 'Force the use of HTTPS for API communication.',
      format: Boolean,
      default: true,
      env: 'HTTPS_ENABLE'
    },
    cert: {
      doc: 'Path to certificate file.',
      format: String,
      default: './config/tls/fwcloud-api.crt',
      env: 'HTTPS_CERT'
    },
    key: {
      doc: 'Path to key file.',
      format: String,
      default: './config/tls/fwcloud-api.key',
      env: 'HTTPS_KEY'
    },
    ca_bundle: {
      doc: 'Path to CA bundle file.',
      format: String,
      default: '',
      env: 'HTTPS_CA_BUNDLE'
    }
  },

  // CORS (Cross-Origin Resource Sharing) options.
  CORS: {
    whitelist: {
      doc: 'CORS (Cross-Origin Resource Sharing) withelist.',
      format:  Array,
      default: [],
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
    expire: {
      doc: 'Expiration seconds for the session cookie.',
      format: 'duration',
      env: 'SESSION_EXPIRE',
      default: 900
    },
    files_path: {
      doc: 'Directory for the session cookies store.',
      format:  String,
      env: 'SESSION_FILES_PATH',
      default: './sessions'
    }
	},

  // Database configuration.
  db: {
    host: {
      doc: 'Database host name or IP address.',
      format: '*',
      default: 'localhost',
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
      default: ['database/migrations/**/*.ts'],
      env: 'TYPEORM_MIGRATIONS'
    },
    migration_directory: {
      doc: 'Database migration directory',
      format: String,
      default: 'database/migrations',
      env: 'TYPEORM_MIGRATION_DIR'
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
      doc: 'Directory in wich the script will be installed in the destinatior firewall',
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

  // Backup configuration.
  backup: {
    data_dir: {
      doc: 'Directory for store the backups.',
      format: String,
      default: './BACKUP/',
      env: 'BACKUP_DATA_DIR'
    },
    schedule: {
      doc: 'Default backup cron based schedule.',
      format: String,
      default: '0 0 2 * * *'
    }
  }  
});

// Perform validation
try {
  config.loadFile('./config/' + config.get('env') + '.json');
  config.validate({allowed: 'strict'});
} catch(err) {
  console.log("Configuration "+err);
  process.exit();
}

if (!config.get('session').secret) {
  console.log("Configuration Error: Session secret must be defined in .env");
  process.exit();  
}

if (!config.get('db').pass) {
  console.log("Configuration Error: Database password must be defined in .env");
  process.exit();  
}

if (!config.get('crypt').secret) {
  console.log("Configuration Error: Encryption secret must be defined in .env");
  process.exit();  
}

config.set('CORS.whitelist',process.env.CORS_WHITELIST.replace(/ +/g,'').split(','));

module.exports = config;
