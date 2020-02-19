export default class ObjectHelpers {

    public static merge(...objects: Object[]): Object {
        let result = {};

        objects.forEach(element => {
            Object.assign(result, element);
        });

        return result;
    }
}