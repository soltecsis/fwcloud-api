import { EntityExporter } from "./entity-exporter";
import { RoutingPosition } from "../../models/routing/routing-position.model";

export class RoutingPositionExporter extends EntityExporter {
    shouldIgnoreThisInstance(position: RoutingPosition): boolean {
        return true;
    }
}