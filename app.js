/**
 * FWCloud NET APP ENTRY POINT
 * 
 *
 * @module APP
 * 
 */

var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');

var log4js = require("log4js");
const log4js_extend = require("log4js-extend");
// This will log file name and line number in each log.
log4js_extend(log4js, {
  path: __dirname,
  //format: "at @name (@file:@line:@column)"
  format: "[@file:@line]"
});


const helmet = require('helmet');
const compression = require('compression');
var bodyParser = require('body-parser');
var session = require('express-session');
var FileStore = require('session-file-store')(session);
var cors = require('cors');

var methodOverride = require('method-override');

const config = require('./config/config');
const accessAuth = require('./middleware/authorization');
const accessCtrl = require('./middleware/access_control');
const inputValidation = require('./middleware/input_validation');
const confirmToken = require('./middleware/confirmation_token');


var app = express();

//configuración para ejs
app.set('views', path.join(__dirname, 'views'));
app.engine("html", require("ejs").renderFile);
app.set('view engine', 'html');

var logger = log4js.getLogger('app');

app.use(log4js.connectLogger(log4js.getLogger("http"), {level: 'auto'}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

// Helmet is a middleware that helps you secure your Express apps by setting various HTTP headers. 
// It's not a silver bullet, but it can help!
app.use(helmet());

// compress responses
app.use(compression());

//configuramos methodOverride
app.use(methodOverride((req, res) => {
	if (req.body && typeof req.body === 'object' && '_method' in req.body) {
		// look in urlencoded POST bodies and delete it
		var method = req.body._method;
		delete req.body._method;
		return method;
	}
}));

//app.use(express.static(path.join(__dirname, 'public')));

// Cross-Origin Resource Sharing (CORS)
// https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
var corsOptions = {
	credentials: true, // WARNING: This is very important and necessary for the session authorization.
	origin: function (origin, callback) {
		if (config.get('CORS').whitelist.indexOf(origin) !== -1) {
			logger.debug("ORIGIN ALLOWED: " + origin);
			callback(null, true);
		} else {
			logger.debug("ORIGIN NOT ALLOWED BY CORS: " + origin);
			callback(new Error('Not allowed by CORS'),false);
		}
	}
};

app.use(cors(corsOptions));


logger.debug("\n\n-------------- INIT FWCLOUD.NET API REST -----------------");


var FwcloudModel = require('./models/fwcloud/fwcloud');
var utilsModel = require("./utils/utils.js");
var api_resp = require('./utils/api_response');


/*--------------------------------------------------------------------------------------*/
// Middleware for user authentication and token validation.
// All routes will use this middleware.
/*--------------------------------------------------------------------------------------*/
app.use(session({
  name: config.get('session').name,
  secret: config.get('session').secret,
  saveUninitialized: false,
  resave: true,
  rolling: true,
  store: new FileStore({ path: config.get('session').files_path }),
  cookie: { 
		httpOnly: false,
		secure: config.get('session').force_HTTPS, // Enable this when the https is enabled for the API.
		maxAge: config.get('session').expire * 1000
  }
}));

// Middleware for access authorization.
app.use(accessAuth.check);
/*--------------------------------------------------------------------------------------*/

// Store the databasse access object in the req object.
app.use(async (req, res, next) => {
	try {
		req.dbCon = await utilsModel.getDbConnection();
		next();
	} catch(error) { api_resp.getJson(null, api_resp.ACR_ERROR, 'Cannot get database access object', null, error, jsonResp => res.status(400).json(jsonResp)) }
});

if (config.get('confirmation_token')) {
	// Middleware for manage confirmation token. 
	// Only required for requests that will change the platform information.
	// Do this before the input data validation process.
	app.use(confirmToken.check);
}

// Middleware for input data validation.
app.use(inputValidation.check);

// Middleware for access control.
app.use(accessCtrl.check);

var db = require('./db');

var user = require('./routes/user/user');
//var customer = require('./routes/user/customer');
var fwcloud = require('./routes/fwcloud/fwcloud');
var cluster = require('./routes/firewall/cluster');
var firewall = require('./routes/firewall/firewall');
var policy_rule = require('./routes/policy/rule');
var policy_compile = require('./routes/policy/compile');
var policy_install = require('./routes/policy/install');
var policy_ipobj = require('./routes/policy/ipobj');
var policy_interface = require('./routes/policy/interface');
var policy_group = require('./routes/policy/group');
var policy_types = require('./routes/policy/types');
var policy_positions = require('./routes/policy/positions');
var interface = require('./routes/interface/interface');
var ipobj = require('./routes/ipobj/ipobj');
var ipobj_group = require('./routes/ipobj/group');
var ipobj_types = require('./routes/ipobj/types');
var ipobj_positions = require('./routes/ipobj/positions');
var tree = require('./routes/tree/tree');
var tree_folder = require('./routes/tree/folder');
var tree_repair = require('./routes/tree/repair');
var vpn_pki = require('./routes/vpn/pki');
var vpn_openvpn = require('./routes/vpn/openvpn');
//var user__firewall = require('./routes/user/user__firewall');
//var interface__ipobj = require('./routes/interface/interface__ipobj');
//var routing_gs = require('./routes/routing/routing_gs');
//var routing_rs = require('./routes/routing/routing_rs');
//var routing_r__ipobjs = require('./routes/routing/routing_r__ipobjs');
//var routing_r__interfaces = require('./routes/routing/routing_r__interfaces');
//var ipobj_type__routing_positions = require('./routes/ipobj/ipobj_type__routing_positions');

//app.use('/', routes);
app.use('/user', user);
//app.use('/customer', customer);
app.use('/fwcloud', fwcloud);
app.use('/cluster', cluster);
app.use('/firewall', firewall);
app.use('/policy/rule', policy_rule);
app.use('/policy/compile', policy_compile);
app.use('/policy/install', policy_install);
app.use('/policy/ipobj', policy_ipobj);
app.use('/policy/interface', policy_interface);
app.use('/policy/group', policy_group);
app.use('/policy/types', policy_types);
app.use('/policy/positions', policy_positions);
app.use('/interface', interface);
app.use('/ipobj', ipobj);
app.use('/ipobj/group', ipobj_group);
app.use('/ipobj/types', ipobj_types);
app.use('/ipobj/positions', ipobj_positions);
app.use('/tree', tree);
app.use('/tree/folder', tree_folder);
app.use('/tree/repair', tree_repair);
app.use('/vpn/pki', vpn_pki);
app.use('/vpn/openvpn', vpn_openvpn);
//app.use('/interface__ipobj', interface__ipobj);
//app.use('/user__firewall', user__firewall);
//app.use('/routing-gs', routing_gs);
//app.use('/routing-rs', routing_rs);
//app.use('/routing-r__ipobjs', routing_r__ipobjs);
//app.use('/routing-r__interfaces', routing_r__interfaces);
//app.use('/ipobj-types__routing_positions', ipobj_type__routing_positions);


// Connect to MySQL on start
db.connect(err => {
	if (err) {
		console.log('Unable to connect to MySQL.');
		process.exit(1);
	}
});

//Interval control for unlock FWCLouds 
const intervalObj = setInterval(() => {
	FwcloudModel.checkFwcloudLockTimeout(config.get('lock').unlock_timeout_min)
			.then(result => {
				logger.debug("OK CHECKLOCK: " + result);
			})
			.catch(result => {
			});
}, config.get('lock').check_interval_mls);


// error handlers
// catch 404 and forward to error handler
app.use(function (req, res, next) {
	var err = new Error('Not Found');
	err.status = 404;
	next(err);
});

// development error handler
// will print stacktrace
if (app.get('env') === 'dev') {
	app.use(function (err, req, res, next) {
		logger.error("Something went wrong: ", err.message);
		res.status(err.status || 500);
		res.render('error', {
			message: err.message,
			error: err
		});
	});
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {
	logger.error("Something went wrong: ", err.message);
	res.status(err.status || 500);
	res.render('error', {
		message: err.message,
		error: {}
	});
});


module.exports = app;