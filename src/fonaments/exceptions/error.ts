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

export class FwCloudError extends Error {
  constructor(error: Error);
  constructor(message: string, stack?: string);
  constructor(errorOrMessage: Error | string = null, stack?: string) {
    super(
      errorOrMessage instanceof Error ? errorOrMessage.message : errorOrMessage,
    );
    this.name = this.constructor.name;

    if (errorOrMessage instanceof Error) {
      this.stack = errorOrMessage.stack;
    }

    if (stack) {
      this.stack = stack;
    }
  }

  public stackToArray(): Array<string> {
    const stack: string = this.stack;
    const results: Array<string> = [];
    const stackLines: Array<string> = stack.split('\n');

    for (let i = 0; i < stackLines.length; i++) {
      const line: string = stackLines[i].trim();
      results.push(line);
    }

    return results;
  }
}
