require('dotenv').config();
var convict = require('convict');

// Define a schema
const config = convict({
  env: {
    doc: 'The application environment.',
    format: ['prod', 'dev', 'test'],
    default: 'dev',
    env: 'NODE_ENV'
  },

  // Server bind parameters.
  listen: {
    ip: {
      doc: 'The IP address to bind.',
      format: 'ipaddress',
      default: '127.0.0.1',
      env: 'LISTEN_IP'
    },
    port: {
      doc: 'The port to bind.',
      format: 'port',
      default: 3000,
      env: 'LISTEN_PORT',
    }
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
      default: false
    },
    expire: {
      doc: 'Expiration seconds for the session cookie.',
      format: 'duration',
      default: 900
    },
    files_path: {
      doc: 'Directory for the session cookies store.',
      format:  String,
      default: './sessions'
    }
	},

  // Database configuration.
  db: {
    host: {
      doc: 'Database host name or IP address.',
      format: '*',
      default: 'localhost',
      env: 'DB_HOST'
    },
    name: {
      doc: 'Database name.',
      format: String,
      default: 'fwcloud_db',
      env: 'DB_NAME'
    },
    user: {
      doc: 'Database user.',
      format: String,
      default: 'fwcloudusr',
      env: 'DB_USER'
    },
    pass: {
      doc: 'Database password.',
      format: String,
      default: '',
      env: 'DB_PASS',
      sensitive: true
    },
    connectionLimit: {
      doc: 'Database maximun connections.',
      format: 'int',
      default: 100,
      env: 'DB_CONNECTION_LIMIT'
    },
    mode: {
      doc: 'Database mode.',
      format: String,
      default: 'mode_production',
      env: 'DB_MODE'
    },
    commitMode: {
      doc: 'Database commint mode.',
      format: 'int',
      default: 1,
      env: 'DB_COMMIT_MODE'
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
      default: './DATA/',
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
  }
});

// Load environment dependent configuration.
//var env = config.get('env');
//config.loadFile('./config/' + env + '.json');

// Perform validation
try {
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

module.exports = config;
