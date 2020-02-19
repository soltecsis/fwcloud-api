import { runApplication } from "../../../utils/utils";
import { RequestInputs } from "../../../../src/fonaments/http/request-inputs";
import { Request } from "express";

describe('Request tests', () => {
    it('All inputs from req.body should be listed in the inputs', async() => {
        const req: any = {
            body: {
                "testInput": "testInput",
                "testInput2": "testInput2"
            }
        }

        const request = new RequestInputs(req);
        expect(request.all()).toEqual([
            {name: 'testInput', value: 'testInput'},
            {name: 'testInput2', value: 'testInput2'},
        ])
    });

    it('hasInput should return false if an input does not exist', async() => {
        const req: any = {}

        const request = new RequestInputs(req);
        
        expect(request.has('testInput2')).toBe(false);
    });

    it('hasInput should return true if an input does exist', async() => {
        const req: any = {
            body: {
                "testInput": "testInput",
            }
        }

        const request = new RequestInputs(req);
        
        expect(request.has('testInput')).toBe(true);
    });

    it('input should return the value if the input exists', async() => {
        const req: any = {
            body: {
                "testInput": "testInput",
            }
        }

        const request = new RequestInputs(req);

        expect(request.get('testInput')).toBe('testInput');
    });

    it('get should return undefined if the input does not exists', async() => {
        const req: any = {}

        const request = new RequestInputs(req);

        expect(request.get('testInput2')).toBeUndefined();
    });

    it('get should return a default value if the input does not exists and a default value is provided', async() => {
        const req: any = {}

        const request = new RequestInputs(req);

        expect(request.get('testInput2', 'defaultValue')).toBe('defaultValue');
    });

    it('query are handled as inputs', async() => {
        const req: any = {
            query: {
                "testInput2": "testInput2"
            },
            body: {
                "testInput": "testInput",
            }
        }

        const request = new RequestInputs(req);

        expect(request.has('testInput2')).toBeTruthy();
    });
});