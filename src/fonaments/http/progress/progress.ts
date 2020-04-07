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

import { EventEmitter } from "typeorm/platform/PlatformTools";
import { ProgressState } from "./progress-state";
import { SequencedTask } from "./sequenced-task";
import { GroupDescription } from "./task";

export type progressEventName = 'start' | 'step' | 'event' | 'end';

export class Progress<T> {
    protected _response: T;
    protected _externalEvents: EventEmitter;
    protected _internalEvents: EventEmitter;

    protected _state: ProgressState;

    protected _failed: boolean;

    constructor(response: T) {
        this._response = response;
        this._externalEvents = new EventEmitter();
        this._internalEvents = new EventEmitter();
        this._failed = false;
    }

    get response(): T {
        return this._response;
    }

    set response(response: T) {
        this._response = response;
    }

    public async procedure(startText: string, procedure: GroupDescription, finishedText: string = null): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const task = new SequencedTask(this._internalEvents, procedure, finishedText);
            this._state = new ProgressState(task.getSteps() + 1, 0, 102, startText);
            
            this._internalEvents.on('step', (message: string) => {
                this.emitExternalEvent('message', this._state.updateState(message, 102, true));
            });

            this._internalEvents.on('event', (message: string) => {
                this.emitExternalEvent('message', this._state.updateState(message, 102, false));
            });

            this.emitExternalEvent('start', this._state);
            
            task.run().then(() => {
                this.emitExternalEvent('message', this._state.updateState(finishedText, 200, false));
                this.emitExternalEvent('end', this._state.updateState(finishedText, 200, true));
                return resolve();
            }).catch((e) => {
                this.emitExternalEvent('message', this._state.updateState('Error', 500, false));
                this._failed = true;
                return resolve();
            });
        });
    }

    protected emitExternalEvent(event: 'start' | 'message' | 'end', data: object): boolean {
        if (!this._failed) {
            return this._externalEvents.emit(event, data);
        }

        return false;
    }

    public on(event: "message" | "end", listener: (...args: any[]) => void): this {
        this._externalEvents.on(event, listener);
        return this;
    }

}