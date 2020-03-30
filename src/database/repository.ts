import { Repository as TypeORMRepository, In } from "typeorm";
import { isArray } from "util";

export class Repository<T> extends TypeORMRepository<T> {
    /**
     * Reloads an entitiy or an array of them
     * 
     * @param oneOrMany One Entity or Array of them
     */
    protected async reloadEntities(oneOrMany: T | Array<T>): Promise<T | Array<T>> {
        if (isArray(oneOrMany)) {
            return await this.find({
                where: {
                    id: In(this.getIdsFromEntityCollection(oneOrMany))
                }
            });
        }

        return this.findOne((<any>oneOrMany).id);
    }

    /**
     * Extract ids from an array of policyRules
     * 
     * @param items 
     */
    protected getIdsFromEntityCollection(items: Array<T>, fn: (item: T) => any = null): Array<T> {
        if (fn === null) {
            fn = (item: any) => {return item.id;}
        }
        if (items.length <= 0) {
            return [null];
        }
        return items.map(fn);
    }
}