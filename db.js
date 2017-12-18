
var mysql = require('mysql');

var PRODUCTION_DB = 'fwcloud_db'
  , TEST_DB = 'fwcloud_db';

exports.MODE_TEST = 'mode_test';
exports.MODE_PRODUCTION = 'mode_production';

var state = {
  pool: null,
  mode: null
};

var conn= null;

exports.connect = function (mode, done) {
  state.pool = mysql.createPool({
    connectionLimit : 100,
    host: 'localhost',
    user: 'soltecsis',
    password: 'WdQ?:(x4',
    database: mode === exports.MODE_PRODUCTION ? PRODUCTION_DB : TEST_DB

  });

  state.mode = mode;
  state.pool.getConnection( function (err, connection) {
    if (err) return done(err);
    conn=connection;
  });
  done();
};

exports.getpool = function() {
  return state.pool;
};

exports.get = function (done) {
  var pool = state.pool;
  if (!pool) 
    return done(new Error('Missing database connection.'));
  
  done(null, conn);

};