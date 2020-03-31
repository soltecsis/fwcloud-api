import { EntityExporter } from "./entity-exporter";
import { User } from "../../models/user/User";

export class UserExporter extends EntityExporter {
    shouldIgnoreThisInstance(user: User): boolean {
        return true;
    }
}