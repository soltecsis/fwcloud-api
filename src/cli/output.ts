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

import chalk from 'chalk';

export class Output {
  protected _stdout;

  constructor(stdout = console.log) {
    this._stdout = stdout;
  }

  public writeln(message: string): void {
    this._stdout(message);
  }

  public writeLine(lines: number = 1): void {
    if (lines > 0) {
      for (let i = 0; i < lines; i++) {
        this.writeln('');
      }
    }
  }

  public success(message: string, margin: number = 1): void {
    this.writeLine(margin);
    this.writeln(chalk.bgGreen.bold.white(`${Output.symbols().ok} ${message}`));
    this.writeLine(margin);
  }

  public warn(message: string, margin: number = 1): void {
    this.writeLine(margin);
    this.writeln(
      chalk.bgYellow.bold.black(`${Output.symbols().warning} ${message}`),
    );
    this.writeLine(margin);
  }

  public error(message: string): void {
    this.writeln(
      chalk.bgRed.bold.white(`${Output.symbols().error} ${message}`),
    );
  }

  public static symbols(): { ok: string; error: string; warning: string } {
    return {
      ok: process.platform === 'win32' ? '\u221A' : '✓',
      error: process.platform === 'win32' ? '\u00D7' : '✖',
      warning: '!',
    };
  }

  public static colors(): any {
    {
      return {
        green: 32,
      };
    }
  }
}
