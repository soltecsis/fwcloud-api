/*!
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Responsable } from '../../contracts/responsable';
import { object } from 'joi';

export class ProgressState implements Responsable {
  protected _steps: number;
  protected _currentStep: number;

  protected _message: string;
  protected _data?: object;
  protected _status: number;

  constructor(
    steps: number,
    currentStep: number = 0,
    status: number = 200,
    message: string = null,
  ) {
    this._message = message;
    this._status = status;
    this._steps = steps;
    this._currentStep = currentStep;
  }

  get percentage(): number {
    return Math.floor((this._currentStep * 100) / this._steps);
  }

  get status(): number {
    return this._status;
  }

  toResponse(): object {
    const response: any = {
      step: this._currentStep,
      steps: this._steps,
      percentage: this.percentage,
      message: this._message,
      status: this._status,
    };

    if (this._data) {
      response.data = this._data;
    }

    return response;
  }

  public updateState(
    message: string = null,
    status: number = 200,
    incrementStep: boolean = false,
  ): ProgressState {
    this._message = message ? message : this._message;
    this._status = status;
    this._currentStep = incrementStep
      ? this._currentStep + 1
      : this._currentStep;

    return new ProgressState(
      this._steps,
      this._currentStep,
      this._status,
      this._message,
    );
  }
}
