//main App Entry FWCloud nodeapi

var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var log4js = require("log4js");
//var morgan = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var bcrypt = require('bcrypt-nodejs');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;



var methodOverride = require('method-override');

// custom libraries
// routes
var route = require('./route');
// model
var Model = require('./model');


var app = express();

passport.use(new LocalStrategy(function(username, password, done) {
   new Model.User({username: username}).fetch().then(function(data) {
      var user = data;
      if(user === null) {
         return done(null, false, {message: 'Invalid username or password'});
      } else {
         user = data.toJSON();
         // Generate a salt
        var salt = bcrypt.genSaltSync(10);
        // Hash the password with the salt
        var hash = bcrypt.hashSync(password, salt);
        
         if(!bcrypt.compareSync(password, user.password)) {
            return done(null, false, {message: 'Invalid username or password'});
         } else {
            return done(null, user);
         }
      }
   });
}));

passport.serializeUser(function(user, done) {
  done(null, user.username);
});

passport.deserializeUser(function(username, done) {
   new Model.User({username: username}).fetch().then(function(user) {
      done(null, user);
   });
});


//configuración para ejs
app.set('views', path.join(__dirname, 'views'));
app.engine("html", require("ejs").renderFile);
app.set('view engine', 'html');

//configuración para Logger and morgan


var logger = log4js.getLogger('app');

app.use(log4js.connectLogger(log4js.getLogger("http"), { level: 'auto' }));

//var http_logger = log4js.getLogger('http');

//var theHTTPLog = morgan({
//  "format": "default",
//  "stream": {
//    write: function(str) { http_logger.debug(str); }
//  }
//});
//
//app.use(morgan('dev'));

//app.use(theHTTPLog);




// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false })); 



//configuramos methodOverride
app.use(methodOverride(function(req, res){
  if (req.body && typeof req.body === 'object' && '_method' in req.body) {
    // look in urlencoded POST bodies and delete it
    var method = req.body._method;
    delete req.body._method;
    return method;
  }
}));

app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


var db = require('./db');


app.use(session({ secret: 'La nieve cae blanca', cookie: { maxAge: 60000 }, resave: true, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());


// GET
app.get('/', route.index);

// signin
// GET
app.get('/signin', route.signIn);
// POST
app.post('/signin', route.signInPost);

// signup
// GET
app.get('/signup', route.signUp);
// POST
app.post('/signup', route.signUpPost);

// logout
// GET
app.get('/signout', route.signOut);

//CONTROL de LOGIN



//var routes = require('./routes/index');
var users = require('./routes/users');
var user__firewalls = require('./routes/user__firewalls');
var customers = require('./routes/customers');
var clusters = require('./routes/clusters');
var firewalls = require('./routes/firewalls');
var routing_gs = require('./routes/routing_gs');
var routing_rs = require('./routes/routing_rs');
var interfaces = require('./routes/interfaces');
var policy_gs = require('./routes/policy_gs');
var policy_rs = require('./routes/policy_rs');
var policy_types = require('./routes/policy_types');
var macs = require('./routes/macs');
var ipobj_gs = require('./routes/ipobj_gs');
var ipobjs = require('./routes/ipobjs');
var ipobj__ipobjgs = require('./routes/ipobj__ipobjgs');
var ipobj_types = require('./routes/ipobj_types');
var policy_r__ipobjs = require('./routes/policy_r__ipobjs');
var routing_r__ipobjs = require('./routes/routing_r__ipobjs');
var policy_r__interfaces = require('./routes/policy_r__interfaces');
var routing_r__interfaces = require('./routes/routing_r__interfaces');
var interface__ipobjs = require('./routes/interface__ipobjs');
var ipobj_type__policy_positions = require('./routes/ipobj_type__policy_positions');
var ipobj_type__routing_positions = require('./routes/ipobj_type__routing_positions');
var policy_positions = require('./routes/policy_positions');


//app.use('/', routes);
app.use('/users', users);
app.use('/user__firewalls', user__firewalls);
app.use('/customers', customers);
app.use('/clusters', clusters);
app.use('/firewalls', firewalls);
app.use('/routing-gs', routing_gs);
app.use('/routing-rs', routing_rs);
app.use('/interfaces', interfaces);
app.use('/policy-gs', policy_gs);
app.use('/policy-rs', policy_rs);
app.use('/policy-types', policy_types);
app.use('/macs', macs);
app.use('/ipobj-gs', ipobj_gs);
app.use('/ipobj__ipobjgs', ipobj__ipobjgs);
app.use('/ipobjs', ipobjs);
app.use('/ipobj-types', ipobj_types);
app.use('/policy-r__ipobjs', policy_r__ipobjs);
app.use('/routing-r__ipobjs', routing_r__ipobjs);
app.use('/policy-r__interfaces', policy_r__interfaces);
app.use('/routing-r__interfaces', routing_r__interfaces);
app.use('/interface__ipobjs', interface__ipobjs);
app.use('/ipobj-types__policy_positions', ipobj_type__policy_positions);
app.use('/ipobj-types__routing_positions', ipobj_type__routing_positions);
app.use('/policy-positions', policy_positions);


// Connect to MySQL on start
db.connect(db.MODE_PRODUCTION, function(err) {
  if (err) {
    console.log('Unable to connect to MySQL.');
    process.exit(1);
  }
});


// error handlers

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        logger.error("Something went wrong: ",err.message);
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });        
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    logger.error("Something went wrong: ",err.message);
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});

module.exports = app;

