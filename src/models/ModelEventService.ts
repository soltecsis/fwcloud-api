import Model from './Model';
import { getRepository } from 'typeorm';
import StringHelper from '../utils/StringHelper';

export class ModelEventService {
    constructor() {}

    public async emit(event: "create" | "update" | "delete" | "all", model: typeof Model, id: any, 
    callback?: (event: "create" | "update" | "delete" | "all", model: typeof Model, id: any) => void) {
        if (callback) {
            return callback(event, model, id);
        }

        const method = StringHelper.toCamelCase('on', event);

        if(model.methodExists(method)) {
            const modelInstance: Model = await getRepository(model).findOne(id);
            
            if (modelInstance) {
                return await modelInstance[method]();
            }
        }

        return null;
    }
}

const modelEventService: ModelEventService = new ModelEventService();

export default modelEventService;