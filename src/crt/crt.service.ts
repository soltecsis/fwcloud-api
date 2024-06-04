import { Application } from "./../cli/Application";
import { getRepository, Repository } from "typeorm";
import { Service } from "../fonaments/services/service";
import { Crt } from "../models/vpn/pki/Crt";

interface IUpdateCrt {
  comment?: string;
}

export class CrtService extends Service {
  protected _repository: Repository<Crt>;

  constructor(app: Application) {
    super(app);
    this._repository = getRepository(Crt);
  }

  public async update(id: number, data: IUpdateCrt): Promise<Crt> {
    let crt: Crt = await this._repository.preload(
      Object.assign({ comment: data.comment }, { id }),
    );

    crt = await this._repository.save(crt);

    return crt;
  }
}
