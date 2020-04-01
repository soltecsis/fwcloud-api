import { Responsable } from "../../contracts/responsable";
import { object } from "joi";

export class ProgressState implements Responsable {
    protected _steps: number;
    protected _currentStep: number;
    
    protected _message: string;
    protected _data?: object;
    protected _status: number;

    constructor(steps: number, currentStep: number = 0, status: number = 200, message: string = null) {
        this._message = message;
        this._status = status;
        this._steps = steps;
        this._currentStep = currentStep;
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

    public updateState(message: string = null, status: number = 200, incrementStep: boolean = false): ProgressState {
        this._message = message ? message : this._message;
        this._status = status;
        this._currentStep = incrementStep ? this._currentStep + 1 : this._currentStep;

        return new ProgressState(this._steps, this._currentStep, this._status, this._message);
    }
}