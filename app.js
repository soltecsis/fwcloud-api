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
const inputValidation = require('./middleware/input_validation');


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
app.use(methodOverride(function (req, res) {
	if (req.body && typeof req.body === 'object' && '_method' in req.body) {
		// look in urlencoded POST bodies and delete it
		var method = req.body._method;
		delete req.body._method;
		return method;
	}
}));

app.use(express.static(path.join(__dirname, 'public')));

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
var UserModel = require('./models/user/user');
var url = require('url');


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
app.use(accessAuth.chek);
/*--------------------------------------------------------------------------------------*/

// Middleware for input data validation.
app.use(inputValidation.check);


var control_routes = ['/firewalls', '/interface*', '/ipobj*', '/policy*', '/routing*', '/fwc-tree*', '/firewallscloud*', '/clusters*', "/fwclouds*"];
//CONTROL FWCLOUD ACCESS
app.use(control_routes, (req, res, next) => {

	var url_parts = url.parse(req.url);
	var pathname = url_parts.pathname;
	var originalURL = req.originalUrl;


	logger.debug("---------------- RECEIVED HEADERS-----------------");
	logger.debug("\n", req.headers);
	logger.debug("--------------------------------------------------");
	logger.debug("METHOD: " + req.method + "   PATHNAME: " + originalURL);

	var iduser = req.session.user_id;
	var fwcloud = req.headers.x_fwc_fwcloud;
	var confirm_token = req.headers.x_fwc_confirm_token;

	var update = true;
	if (req.method === 'GET')
		update = false;


	logger.warn("API CHECK FWCLOUD ACCESS USER : [" + iduser + "] --- FWCLOUD: [" + fwcloud + "]   ACTION UPDATE: " + update);

	if (originalURL === '/fwclouds/fwcloud' && req.method === 'POST') {
		logger.debug("FWCLOUD ACCESS TO CREATE");
		logger.debug(req.body);
		//save access to user                
		var userData = {id: iduser};
		UserModel.updateUserTS(userData, function (error, data) {});        
		req.fwc_access = true;
		req.iduser = iduser;
		next();
	} 
	else if (originalURL === '/fwclouds/fwcloud' && req.method === 'PUT') {
		logger.debug("FWCLOUD ACCESS TO UPDATE");
		logger.debug(req.body);
		//save access to user                
		var userData = {id: iduser};
		UserModel.updateUserTS(userData, function (error, data) {});        
		req.fwc_access = true;
		req.confirm_token = confirm_token;
		req.iduser = iduser;
		req.fwcloud = req.body.id;
		req.restricted = {};
		next();
	}
	else if (utilsModel.startsWith(originalURL,'/fwclouds') && req.method === 'GET' && fwcloud==='') {
		//Acces to GET ALL clouds
		logger.debug("FWCLOUD ACCESS INITIAL CLOUDS");
		var userData = {id: iduser};
		UserModel.updateUserTS(userData, function (error, data) {});        
		req.fwc_access = true;
		req.iduser = iduser;
		next();
	}
	 else if (utilsModel.startsWith(originalURL,'/fwclouds/del/fwcloud/') && req.method === 'PUT' && fwcloud==='') {
		//Acces to GET ALL clouds
		logger.debug("FWCLOUD DELETE");
		var userData = {id: iduser};
		UserModel.updateUserTS(userData, function (error, data) {});        
		req.fwc_access = true;
		req.confirm_token = confirm_token;
		req.iduser = iduser;
		//request.fwcloud = request.params.fwcloud;
		req.restricted = {};
		//logger.debug("DELETING FWCLOUD: " + request.fwcloud );
		next();
	}
	else {
		utilsModel.checkFwCloudAccess(iduser, fwcloud, update, req, res)
				.then(resp => {
					//save access to user                
					var userData = {id: iduser};
					UserModel.updateUserTS(userData, function (error, data) {});
					req.confirm_token = confirm_token;
					req.restricted = {};
					next();
				})
				.catch(err => {
					logger.error("ERROR ---> err: " + err);
					api_resp.getJson(null, api_resp.ACR_ACCESS_ERROR, 'PARAM ERROR. FWCLOUD ACCESS NOT ALLOWED ', '', null, function (jsonResp) {
						res.status(200).json(jsonResp);
					});
				});
	}

});


var db = require('./db');

var users = require('./routes/user/users');
var user__firewalls = require('./routes/user/user__firewalls');
var customers = require('./routes/user/customers');
var clusters = require('./routes/firewall/clusters');
var firewalls = require('./routes/firewall/firewalls');
var fwclouds = require('./routes/fwcloud/fwclouds');
var routing_gs = require('./routes/routing/routing_gs');
var routing_rs = require('./routes/routing/routing_rs');
var interfaces = require('./routes/interface/interfaces');
var policy_gs = require('./routes/policy/policy_gs');
var policy_rs = require('./routes/policy/policy_rs');
var policy_types = require('./routes/policy/policy_types');
var ipobj_gs = require('./routes/ipobj/ipobj_gs');
var ipobjs = require('./routes/ipobj/ipobjs');
var ipobj__ipobjgs = require('./routes/ipobj/ipobj__ipobjgs');
var ipobj_types = require('./routes/ipobj/ipobj_types');
var policy_r__ipobjs = require('./routes/policy/policy_r__ipobjs');
var routing_r__ipobjs = require('./routes/routing/routing_r__ipobjs');
var policy_r__interfaces = require('./routes/policy/policy_r__interfaces');
var routing_r__interfaces = require('./routes/routing/routing_r__interfaces');
var interface__ipobjs = require('./routes/interface/interface__ipobjs');
var ipobj_type__policy_positions = require('./routes/ipobj/ipobj_type__policy_positions');
var ipobj_type__routing_positions = require('./routes/ipobj/ipobj_type__routing_positions');
var policy_positions = require('./routes/policy/policy_positions');
var fwc_tree = require('./routes/tree/fwc_tree');
var fwc_tree_folder = require('./routes/tree/folder');
var fwc_tree_repair = require('./routes/tree/repair');
var policy_compile = require('./routes/policy/compile');
var policy_install = require('./routes/policy/install');
var stream = require('./routes/stream/stream');
var openvpn = require('./routes/vpn/openvpn');

//app.use('/', routes);
app.use('/users', users);
app.use('/user__firewalls', user__firewalls);
app.use('/customers', customers);
app.use('/clusters', clusters);
app.use('/firewalls', firewalls);
app.use('/fwclouds', fwclouds);
app.use('/policy-gs', policy_gs);
app.use('/policy-rs', policy_rs);
app.use('/policy-types', policy_types);
app.use('/policy-r__ipobjs', policy_r__ipobjs);
app.use('/policy-r__interfaces', policy_r__interfaces);
app.use('/policy-positions', policy_positions);
app.use('/policy/compile', policy_compile);
app.use('/policy/install', policy_install);
app.use('/routing-gs', routing_gs);
app.use('/routing-rs', routing_rs);
app.use('/routing-r__ipobjs', routing_r__ipobjs);
app.use('/routing-r__interfaces', routing_r__interfaces);
app.use('/ipobj-gs', ipobj_gs);
app.use('/ipobj__ipobjgs', ipobj__ipobjgs);
app.use('/ipobjs', ipobjs);
app.use('/ipobj-types', ipobj_types);
app.use('/ipobj-types__policy_positions', ipobj_type__policy_positions);
app.use('/ipobj-types__routing_positions', ipobj_type__routing_positions);
app.use('/interfaces', interfaces);
app.use('/interface__ipobjs', interface__ipobjs);
app.use('/fwc-tree', fwc_tree);
app.use('/fwc-tree/folder', fwc_tree_folder);
app.use('/fwc-tree/repair', fwc_tree_repair);
app.use('/stream', stream);
app.use('/vpn/openvpn', openvpn);


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