import { describeName, expect, playgroundPath } from "../../mocha/global-setup";
import * as path from "path";
import { PathHelper } from "../../../src/utils/path-helpers";

describe(describeName('PathHelper tests'), () => {
    
    describe('directoryName()', () => {
        it('directoryName() should return the directory name which contains the path', () => {
            expect(PathHelper.directoryName(path.join(playgroundPath, 'test'))).to.be.deep.eq('test');
        });
    })
})