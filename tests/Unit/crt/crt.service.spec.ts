import { describeName, testSuite, expect } from "./../../mocha/global-setup";
import { FwCloud } from "./../../../src/models/fwcloud/FwCloud";
import { Application } from "../../../src/Application";
import { beforeEach } from "mocha";
import { getRepository } from "typeorm";
import StringHelper from "../../../src/utils/string.helper";
import { CrtService } from "../../../src/crt/crt.service";
import { Crt } from "../../../src/models/vpn/pki/Crt";
import { Ca } from "../../../src/models/vpn/pki/Ca";

describe(describeName("Crt Service Unit Test"), () => {
  let app: Application;
  let service: CrtService;
  let fwCloud: FwCloud;
  let crt: Crt;
  let ca: Ca;
  let changeComment: string;

  beforeEach(async () => {
    app = testSuite.app;
    fwCloud = await getRepository(FwCloud).save(
      getRepository(FwCloud).create({
        name: "fwcloudTest",
      }),
    );
    ca = await getRepository(Ca).save(
      getRepository(Ca).create({
        fwCloudId: fwCloud.id,
        cn: "caTest",
        days: 1000,
        comment: "testcomment",
      }),
    );
    crt = await getRepository(Crt).save(
      getRepository(Crt).create({
        caId: ca.id,
        cn: "crtTtest",
        days: 1000,
        type: 1,
        comment: "testComment",
      }),
    );
    service = await app.getService<CrtService>(CrtService.name);

    changeComment = StringHelper.randomize(10);
  });

  describe("update()", () => {
    it("should update the comment of crt", async () => {
      await service.update(crt.id, { comment: changeComment });

      crt = await getRepository(Crt).findOne(crt.id);

      expect(crt.comment).to.be.equal(changeComment);
    });
    it("should return updated crt", async () => {
      crt = await service.update(crt.id, { comment: changeComment });

      expect(crt.comment).to.be.equal(changeComment);
    });
  });
});
