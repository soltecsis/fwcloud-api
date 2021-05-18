import { EntityRepository, Repository} from "typeorm";
import { RouteGroup } from "./route-group.model";

@EntityRepository(RouteGroup)
export class RouteGroupRepository extends Repository<RouteGroup> {
}