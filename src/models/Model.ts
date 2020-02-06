export interface IModel {
    getTableName(): string;
}

export default abstract class Model implements IModel {
    public abstract getTableName(): string;

    public static methodExists(method: string): boolean {
        return typeof this[method] === 'function' || typeof this.prototype[method] === 'function';
    }
}