import { Responsable } from "../../contracts/responsable";
import { object } from "joi";

export class ProgressState implements Responsable {
    protected _steps: number;
    protected _currentStep: number;
    
    protected _message: string;
    protected _data?: object;
    protected _status: number;

    constructor(steps: number, currentStep: number = 0, message: string = null, status: number = 200) {
        this._steps = steps;
        this._currentStep = currentStep;
        this._message = message;
        this._status = status;
    }

    get percentage(): number {
        return Math.floor((this._currentStep * 100) / this._steps);
    }

    toResponse(): object {
        const response: any = {
            step: this._currentStep,
            steps: this._steps,
            percentage: this.percentage,
            message: this._message,
            status: this._status
        }

        if (this._data) {
            response.data = this._data;
        }

        return response;
    }

    public setStep(step: number, status: number = 200, message?: string): ProgressState {
        this._currentStep = (step <= this._steps) ? step: this._steps;
        this._status = status;
        if (message) {
            this._message = message;
        }

        return new ProgressState(this._steps, this._currentStep, this._message, this._status);
    }

    public setMessage(message: string): ProgressState {
        this._message = message;

        return new ProgressState(this._steps, this._currentStep, this._message, this._status);
    }

    public incrementStep(status: number = 200, message?: string): ProgressState {
        return this.setStep(this._currentStep + 1, status, message);
    }
}