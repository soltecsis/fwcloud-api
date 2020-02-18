export class FunctionHelper {

    //TODO: Look for a better way to check whether value is a callback instead of a class definition
    public static isCallback(value: any): boolean {
        return typeof value.prototype === 'undefined';
    }
}