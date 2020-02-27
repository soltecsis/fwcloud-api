import { RequestInputs } from "../../../../src/fonaments/http/request-inputs";
import { expect, describeName } from "../../../mocha/global-setup";

describe(describeName('Request tests'), () => {
    it('All inputs from req.body should be listed in the inputs', async() => {
        const req: any = {
            body: {
                "testInput": "testInput",
                "testInput2": "testInput2"
            }
        }

        const request = new RequestInputs(req);
        expect(request.all()).to.be.deep.equal({
            'testInput': 'testInput',
            'testInput2': 'testInput2',
        })
    });

    it('hasInput should return false if an input does not exist', async() => {
        const req: any = {}

        const request = new RequestInputs(req);
        
        expect(request.has('testInput2')).to.be.false;
    });

    it('hasInput should return true if an input does exist', async() => {
        const req: any = {
            body: {
                "testInput": "testInput",
            }
        }

        const request = new RequestInputs(req);
        
        expect(request.has('testInput')).to.be.true;
    });

    it('input should return the value if the input exists', async() => {
        const req: any = {
            body: {
                "testInput": "testInput",
            }
        }

        const request = new RequestInputs(req);

        expect(request.get('testInput')).to.be.deep.equal('testInput');
    });

    it('get should return undefined if the input does not exists', async() => {
        const req: any = {}

        const request = new RequestInputs(req);

        expect(request.get('testInput2')).to.be.undefined;
    });

    it('get should return a default value if the input does not exists and a default value is provided', async() => {
        const req: any = {}

        const request = new RequestInputs(req);

        expect(request.get('testInput2', 'defaultValue')).to.be.deep.equal('defaultValue');
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

        expect(request.has('testInput2')).to.be.true;
    });
});