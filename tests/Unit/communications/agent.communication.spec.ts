/*
    Copyright 2022 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { AgentCommunication } from "../../../src/communications/agent.communication";
import axios from "axios";
import sinon from "sinon";
import { CCDHash } from "../../../src/communications/communication";
import { expect } from "../../mocha/global-setup";
import * as https from "https";

describe(AgentCommunication.name, () => {
  let agent: AgentCommunication;

  beforeEach(async () => {
    agent = new AgentCommunication({
      protocol: "http",
      host: "host",
      port: 0,
      apikey: "",
    });
  });

  it("should set custom agent when https is enabled", () => {
    agent = new AgentCommunication({
      protocol: "https",
      host: "host",
      port: 0,
      apikey: "",
    });

    expect(
      (agent["config"].httpsAgent as https.Agent).options.rejectUnauthorized,
    ).to.be.false;
  });

  describe("ccdHashList", () => {
    let stub: sinon.SinonStub;

    beforeEach(() => {
      stub = sinon.stub(axios, "put");
      stub.returns(
        Promise.resolve({
          status: 200,
          data: "file,sha256\ncrt1,hash1\ncrt2,hash2",
        }),
      );
    });

    it("should parse CSV content", async () => {
      const result: CCDHash[] = await agent.ccdHashList("");

      expect(result).to.deep.eq([
        { filename: "crt1", hash: "hash1" },
        { filename: "crt2", hash: "hash2" },
      ]);
    });
  });
});
