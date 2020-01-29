const app = require('../../../src/app');
const request = require('supertest');

describe('(GET) /customer', () => {

  it('should return 400 Bad Request if the user is not authenticated', (done) => {
    request(app)
      .get('/customers')
      .expect(400, done);
  });
});