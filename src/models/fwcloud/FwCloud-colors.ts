/*
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

export interface colorUsage {
  color: string;
  count: number;
}

export class fwcloudColors {
  private _colors: colorUsage[] = [];

  constructor(data: any[]) {
    for (let item of data)
      this._colors.push({ color: item.color, count: parseInt(item.count) });
  }

  get colors(): colorUsage[] {
    return this._colors;
  }

  get length(): number {
    return this._colors.length;
  }

  public isEmpty(): boolean {
    return this._colors.length === 0 ? true : false;
  }

  public empty(): void {
    this._colors = [];
  }

  public found(cu: colorUsage): boolean {
    let found: boolean = false;

    for (let item of this._colors) {
      if (JSON.stringify(cu) === JSON.stringify(item)) {
        found = true;
        break;
      }
    }

    return found;
  }

  public foundAll(cua: colorUsage[]): boolean {
    let allFound: boolean = true;
    let found: boolean;

    for (let cua_item of cua) {
      found = false;

      for (let item of this._colors) {
        if (JSON.stringify(cua_item) === JSON.stringify(item)) {
          found = true;
          break;
        }
      }
      if (!found) {
        allFound = false;
        break;
      }
    }

    return allFound;
  }

  public add(cu: colorUsage): void {
    this._colors.push(cu);
  }

  public combine(other: fwcloudColors): void {
    if (other.length > 0) {
      for (let item1 of this._colors) {
        for (let item2 of other.colors) {
          if (item1.color === item2.color) {
            item1.count += item2.count;
            other.colors.shift();
            break;
          }
        }
        if (other.length === 0) break;
      }

      if (other.length > 0) {
        for (let item2 of other.colors) this._colors.push(item2);
      }
    }
  }

  public sort(): void {
    this._colors.sort((a: colorUsage, b: colorUsage) => b.count - a.count);
  }

  public isSorted(): boolean {
    let prevCount: number = -1;
    let sorted: boolean = true;

    for (let item of this._colors) {
      if (prevCount === -1) {
        // We are at the first item.
        prevCount = item.count;
        continue;
      }

      if (prevCount < item.count) {
        // Items are not ordered in descending count order.
        sorted = false;
        break;
      }
    }

    return sorted;
  }
}
