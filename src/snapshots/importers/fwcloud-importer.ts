import { FwCloud } from "../../models/fwcloud/FwCloud";
import { EntityImporter } from "./entity-importer";
import { DeepPartial } from "typeorm";

export class FwCloudImporter  extends EntityImporter<FwCloud> {
    customAttributeChanges(data: DeepPartial<FwCloud>): DeepPartial<FwCloud> {
        data.name = 'fwcloud - ' + this._snapshot.id;
        return data;
    }
}