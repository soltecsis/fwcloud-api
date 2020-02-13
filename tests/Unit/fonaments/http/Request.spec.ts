import { Request } from "../../../../src/fonaments/http/Request";

describe('Request tests', () => {
    it('All inputs from req.body should be listed in the inputs', async() => {
        const req = {
            body: {
                "testInput": "testInput",
                "testInput2": "testInput2"
            }
        }

        const request = new Request(req);
        expect(request.getInputs()).toEqual([
            {name: 'testInput', value: 'testInput'},
            {name: 'testInput2', value: 'testInput2'},
        ])
    });

    it('hasInput should return false if an input does not exist', async() => {
        const req = {}

        const request = new Request(req);
        
        expect(request.hasInput('testInput2')).toBe(false);
    });

    it('hasInput should return true if an input does exist', async() => {
        const req = {
            body: {
                "testInput": "testInput",
            }
        }

        const request = new Request(req);
        
        expect(request.hasInput('testInput')).toBe(true);
    });

    it('input should return the value if the input exists', async() => {
        const req = {
            body: {
                "testInput": "testInput",
            }
        }

        const request = new Request(req);

        expect(request.input('testInput')).toBe('testInput');
    });

    it('input should return null if the input does not exists', async() => {
        const req = {}

        const request = new Request(req);

        expect(request.input('testInput2')).toBeNull();
    });

    it('input should return a default value if the input does not exists and a default value is provided', async() => {
        const req = {}

        const request = new Request(req);

        expect(request.input('testInput2', 'defaultValue')).toBe('defaultValue');
    });

    it('params are handled as inputs', async() => {
        const req = {
            params: {
                "testInput2": "testInput2"
            },
            body: {
                "testInput": "testInput",
            }
        }

        const request = new Request(req);

        expect(request.hasInput('testInput2')).toBeTruthy();
    });

    it('addInputObject should add inputs from the object', async() => {
        const req = {
            body: {
                "testInput": "testInput",
            }
        }

        const request = new Request(req);

        request.addInputs({"testInput2": "testInput2"});

        expect(request.hasInput('testInput2')).toBeTruthy();
    })


});