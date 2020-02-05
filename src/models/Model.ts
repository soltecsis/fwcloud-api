export interface IModel {
    getTableName(): string;
}

export default abstract class Model implements IModel {
    public abstract getTableName(): string;
}