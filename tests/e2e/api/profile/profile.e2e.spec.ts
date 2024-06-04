import { Application } from "../../../../src/Application";
import { User } from "../../../../src/models/user/User";
import { describeName, expect, testSuite } from "../../../mocha/global-setup";
import {
  attachSession,
  createUser,
  generateSession,
} from "../../../utils/utils";
import request = require("supertest");
import Sinon = require("sinon");
const speakeasy = require("speakeasy");

describe(describeName("FwCloud 2 Factor Authentication E2E Test"), () => {
  let app: Application;
  let adminUser: User;
  let adminUserSessionId: string;
  let loggedUser: User;
  let loggedUserSessionId: string;
  let stub;

  before(async () => {
    app = testSuite.app;

    loggedUser = await createUser({ role: 0 });

    adminUser = await createUser({ role: 1 });
  });

  beforeEach(() => {
    adminUserSessionId = generateSession(adminUser);
    loggedUserSessionId = generateSession(loggedUser);
  });

  describe("TFAController@setup", () => {
    it("Guest User should not setup 2FA", async () => {
      return await request(app.express)
        .post("/profile/tfa/setup")
        .send({
          user: adminUser.id,
          username: adminUser.username,
        })
        .expect(401);
    });
    it("User can setup 2FA", async () => {
      return await request(app.express)
        .post("/profile/tfa/setup")
        .set("Cookie", [attachSession(adminUserSessionId)])
        .send({
          user: adminUser.id,
          username: adminUser.username,
        })
        .expect(200);
    });
  });

  describe("TFAController@getSetup", () => {
    it("Guest User can not get 2FA", async () => {
      return await request(app.express).get("/profile/tfa/setup").expect(401);
    });

    it("User does not have 2FA", async () => {
      return await request(app.express)
        .get("/profile/tfa/setup")
        .set("Cookie", [attachSession(loggedUserSessionId)])
        .expect(200)
        .then((response) => {
          expect(response.body.data.tfa).to.be.undefined;
        });
    });

    it("User have 2FA", async () => {
      return await request(app.express)
        .get("/profile/tfa/setup")
        .set("Cookie", [attachSession(adminUserSessionId)])
        .expect(200)
        .then((res) => {
          expect(res.body.data).not.to.be.empty;

          expect(res.body.data.tfa).to.have.property("secret");
          expect(res.body.data.tfa).to.have.property("tempSecret");
          expect(res.body.data.tfa).to.have.property("dataURL");
          expect(res.body.data.tfa).to.have.property("tfaURL");
          expect(res.body.data.tfa).to.have.property("userId");
        });
    });
  });

  describe("TFAController@verify", () => {
    before(() => {
      stub = Sinon.stub(speakeasy.totp, "verify");
    });

    it("Guest User should not verify AuthCode", async () => {
      await request(app.express)
        .post("/profile/tfa/verify")
        .send({
          tempSecret: "NoMatterTempSecret",
          authCode: "NoMatterAuthCode",
        })
        .expect(401);
    });

    it("User verify correctly AuthCode", async () => {
      stub.returns(true);

      await request(app.express)
        .post("/profile/tfa/verify")
        .set("Cookie", [attachSession(adminUserSessionId)])
        .send({
          tempSecret: "CorrectTempSecret",
          authCode: "CorrectAuthCode",
        })
        .expect(200);
    });

    it("User verify incorrectly AuthCode", async () => {
      stub.returns(false);

      await request(app.express)
        .post("/profile/tfa/verify")
        .set("Cookie", [attachSession(adminUserSessionId)])
        .send({
          tempSecret: "CorrectTempSecret",
          authCode: "IncorrectAuthCode",
        })
        .expect(401);
    });
  });

  describe("TFAController@deleteSetup", () => {
    it("Guest User should not delete 2FA", async () => {
      return await request(app.express)
        .delete("/profile/tfa/setup")
        .expect(401);
    });
    it("User delete 2FA", async () => {
      return await request(app.express)
        .delete("/profile/tfa/setup")
        .set("Cookie", [attachSession(adminUserSessionId)])
        .expect(204);
    });
    it("User whit not 2FA Delete", async () => {
      return await request(app.express)
        .delete("/profile/tfa/setup")
        .set("Cookie", [attachSession(loggedUserSessionId)])
        .expect(204);
    });
  });
});
