var logger = require('log4js').getLogger("app");

var mysql = require('mysql');
var config = require('./config/config');

var state = {
	pool: null,
	mode: null,
	commit: 1
};

var conn = null;

exports.connect = function (done) {

	logger.debug("---- CREATING DATABASE POOL : ");

	configDB = config.get('db');
	state.pool = mysql.createPool({
		connectionLimit: configDB.connectionLimit,
		timeout: 100000,
		connectTimeout: 100000,        
		host: configDB.host,
		user: configDB.user,
		password: configDB.pass,
		database: configDB.name

	});

	state.mode = configDB.mode;
	state.commit = configDB.commitMode;

	logger.debug("---- CONECTING DATABASE : ");

	state.pool.getConnection(function (err, connection) {
		if (err){
			logger.debug("---- ERROR CONECTING DATABASE: ", err);
			return done(err);
		}
		else {
			conn = connection;
			var sql = "SET AUTOCOMMIT=" + state.commit + ";";
			conn.query(sql, function (error, result) {});
			logger.debug("----  DATABASE CONNECTED in MODE: " + state.mode + "  AUTOCOMMIT: " + state.commit + "  -----");
		}
	});
	done();
};

exports.getpool = function () {
	return state.pool;
};

exports.get = function (done) {
	var pool = state.pool;
	if (!pool)
		return done(new Error('Missing database connection.'));

	done(null, conn);

};

exports.lockTable = function (cn, table, where, done) {
	cn.query("SELECT count(*) from " + table + " " + where + " FOR UPDATE;", function (error, result) {
		if (error)
			logger.debug("DATABASE ERROR IN LOCK TABLE : " + error);
		else
			logger.debug("TABLE " + table + " LOCKED");
	});
	done();
};

exports.lockTableCon = function (table, where, done) {
	conn.query("SELECT count(*) from " + table + " " + where + " FOR UPDATE;", function (error, result) {
		if (error)
			logger.debug("DATABASE ERROR IN LOCK TABLE : " + error);
		else
			logger.debug("TABLE " + table + " LOCKED");
	});
	done();
};


exports.startTX = function (cn, done) {
	cn.query("START TRANSACTION;", function (error, result) {
		if (error)
			logger.debug("DATABASE ERROR IN START TRANSACTION : " + error);
		else
			logger.debug("START TX");
	});
	done();
};
exports.startTXcon = function (done) {
	conn.query("START TRANSACTION;", function (error, result) {
		if (error)
			logger.debug("DATABASE ERROR IN START TRANSACTION : " + error);
		else
			logger.debug("START TX");
	});
	done();
};

exports.endTX = function (cn, done) {
	cn.query("COMMIT;", function (error, result) {
		if (error)
			logger.debug("DATABASE ERROR IN COMMIT TRANSACTION: " + error);
		else
			logger.debug("END TX");
	});
	done();
};

exports.endTXcon = function (done) {
	conn.query("COMMIT;", function (error, result) {
		if (error)
			logger.debug("DATABASE ERROR IN COMMIT TRANSACTION: " + error);
		else
			logger.debug("END TX");
	});
	done();
};

exports.backTX = function (cn, done) {
	cn.query("ROLLBACK;", function (error, result) {
		if (error)
			logger.debug("DATABASE ERROR IN ROLLBACK TRANSACTION ");
		else
			logger.debug("ROLLBACK TX");
	});
	done();
};

exports.backTXcon = function (done) {
	conn.query("ROLLBACK;", function (error, result) {
		if (error)
			logger.debug("DATABASE ERROR IN ROLLBACK TRANSACTION ");
		else
			logger.debug("ROLLBACK TX");
	});
	done();
};
