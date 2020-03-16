import { Responsable } from "../../contracts/responsable";

export class ProgressEvent implements Responsable {
    protected _steps: number;
    protected _currentStep: number;
    
    protected _message: string;
    protected _status: number;

    constructor(steps: number) {
        this._steps = steps;
        this._currentStep = 1;
        this._message = null;
        this._status = 200;
    }

    get percentage(): number {
        return Math.floor((this._currentStep * 100) / this._steps);
    }

    toResponse(): Object {
        return {
            step: this._currentStep,
            steps: this._steps,
            percentage: this.percentage,
            message: this._message,
            status: this._status
        }
    }

    public setStep(step: number, status: number = 200, message?: string): this {
        this._currentStep = step <= this._steps? step: this._steps;
        this._status = status;
        if (message) {
            this._message = message;
        }

        return this;
    }

    public incrementStep(status: number = 200, message?: string): this {
        this._currentStep = this._currentStep + 1;
        return this.setStep(this._currentStep, status, message);
    }
}