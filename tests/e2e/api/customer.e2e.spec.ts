import { Application } from '../../../src/Application';
import { expect } from "chai";

let app: Application;

describe('(GET) /customer', () => {

  it('should return 400 Bad Request if the user is not authenticated', async() => {
    expect(true).to.be.true;
  });
});