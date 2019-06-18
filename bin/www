#!/usr/bin/env node

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


/**
 * Module dependencies.
 */

var config = require('../config/config');
var app = require('../app');
var debug = require('debug')('nodeapi:server');


/**
 * Create the logs directory, just in case it isn't there.
 */
try {
  require('fs').mkdirSync('./logs');
} catch (e) {
  if (e.code !== 'EEXIST') {
    console.error("Could not create the logs directory. ERROR: ", e);
    process.exit(1);
  }
}

/**
 * Create the data directories, just in case them aren't there.
 */
try {
  require('fs').mkdirSync('./DATA');
  require('fs').mkdirSync(config.get('policy').data_dir);
  require('fs').mkdirSync(config.get('pki').data_dir);
} catch (e) {
  if (e.code !== 'EEXIST') {
    console.error("Could not create the data directory. ERROR: ", e);
    process.exit(1);
  }
}

/**
 * Initialise log4js first, so we don't miss any log messages
 */
var log4js = require('log4js');
log4js.configure('./config/log4js_configuration.json');

var log = log4js.getLogger("startup");


/**
 * Get port from environment and store in Express.
 */
const port = config.get('listen').port;
const listen_ip = config.get('listen').ip;
app.set('port', port);
app.set('domain', listen_ip);

/**
 * Create HTTP or HTTPS server.
 */
var server;
try {
  if (config.get('https').enable) {
    var https = require('https');
    var fs = require('fs');
    var tlsOptions = {
      key: fs.readFileSync(config.get('https').key),
      cert: fs.readFileSync(config.get('https').cert)
    }; 

    if (config.get('https').ca_bundle)
      tlsOptions.ca = fs.readFileSync(config.get('https').ca_bundle);

    server = https.createServer(tlsOptions, app);
  } 
  else {
    var http = require('http');
    server = http.createServer(app);
  }
} catch(e) {
  console.error("ERROR CREATING HTTP/HTTPS SERVER: ",e);
  process.exit(1);
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}


/**
 * Listen on provided port, on all network interfaces.
 */
server.listen(port,listen_ip);
server.on('error', onError);
server.on('listening', onListening);


/**
 * Socket.io
 */
const io = require('socket.io')(server);
// For acces the socketio object from the routes management code.
app.set('socketio', io);

io.on('connection', socket => {
  if (config.get('env')==='dev') console.log('user connected',socket.id);
  socket.on('disconnect', () => {
    if (config.get('env')==='dev') console.log('user disconnected',socket.id);
  });
});
