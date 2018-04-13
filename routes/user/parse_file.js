var fs = require('fs');

var ParseFile = function(filename) {

  var ts = require('stream').Transform();

  ts._transform = function (chunk, enc, next) {
    parsedChunk = '<chunk>' + chunk + '</chunk>'; // Do some parsing here...
    this.push(parsedChunk);
    next();
  };

  return fs.createReadStream(filename).pipe(ts);

};   

module.exports = ParseFile;
