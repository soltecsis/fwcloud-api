import { EntityExporter } from "./entity-exporter";
import { PolicyType } from "../../models/policy/PolicyType";

export class PolicyTypeExporter extends EntityExporter {
    shouldIgnoreThisInstance(type: PolicyType): boolean {
        return true;
    }
}