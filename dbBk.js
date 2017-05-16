
 var knex = require('knex')({
        client: 'mysql',
        connection: {
            host: 'localhost',
            user: 'soltecsis',
            password: 'WdQ?:(x4',
            database: 'fwcloud_db',
            charset  : 'utf8'
        }
    });

    var Bookshelf = require('bookshelf')(knex);

    module.exports.DB = Bookshelf;

