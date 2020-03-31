import { EntityExporter } from "./entity-exporter";
import { PolicyPosition } from "../../models/policy/PolicyPosition";

export class PolicyPositionExporter extends EntityExporter {
    shouldIgnoreThisInstance(position: PolicyPosition): boolean {
        return true;
    }
}