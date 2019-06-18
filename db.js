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
