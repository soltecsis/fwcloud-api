import { describeName, expect } from "../../../../mocha/global-setup";
import { ErrorBag } from "../../../../../src/fonaments/validation/error-bag";

describe(describeName('Error Bag Unit Tests'), () => {
    let errorBag: ErrorBag;
    
    
    beforeEach(() =>  {
        errorBag = new ErrorBag();
    });

    describe('add()', () => {
        it('should create the input name property in errors object', () => {
            errorBag.add("test", "this is an error message");

            expect(errorBag["_errors"]).to.haveOwnProperty("test");
        });

        it('should add the error message', () => {
            errorBag.add("test", "this is an error message");
            errorBag.add("test", "other message");

            expect(errorBag["_errors"]["test"]).to.be.deep.eq([
                "this is an error message",
                "other message"
            ]);
        });
    });

    describe('get()', () => {
        it('should return the message array if the input exists', () => {
            errorBag.add("test", "this is an error message");
            errorBag.add("test", "other message");

            expect(errorBag.get("test")).to.be.deep.eq([
                "this is an error message",
                "other message"
            ]);
        });

        it('should return empty array if the input does not exist', () => {
            expect(errorBag.get("test")).to.be.deep.eq([]);
        })
    });
});