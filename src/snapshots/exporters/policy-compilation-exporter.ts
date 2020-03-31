import { EntityExporter } from "./entity-exporter";
import { PolicyCompilation } from "../../models/policy/PolicyCompilation";

export class PolicyCompilationExporter extends EntityExporter {
    shouldIgnoreThisInstance(compilation: PolicyCompilation): boolean {
        return true;
    }
}