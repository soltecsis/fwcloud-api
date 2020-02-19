import request from 'supertest';
import { Application } from '../../../src/Application';
import { runApplication } from '../../utils/utils';

let app: Application;

beforeAll(async() => {
  app = await runApplication();
})

describe('(GET) /customer', () => {

  it('should return 400 Bad Request if the user is not authenticated', (done) => {
    request(app)
      .get('/customers')
      .expect(400, done);
  });
});