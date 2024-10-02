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

export default class ObjectHelpers {
  public static merge(...objects: object[]): object {
    const result = {};

    objects.forEach((element) => {
      Object.assign(result, element);
    });

    return result;
  }

  public static deepMerge<T extends Record<string, unknown> = Record<string, unknown>>(
    target: T,
    ...sources: Partial<T>[]
  ): T {
    function isObject(item) {
      return item && typeof item === 'object' && !Array.isArray(item);
    }

    if (!sources.length) {
      return target;
    }
    const source: Partial<T> = sources.shift();

    if (isObject(target) && isObject(source)) {
      for (const key in source) {
        if (isObject(source[key])) {
          if (!target[key]) {
            Object.assign(target, { [key]: {} });
          }
          this.deepMerge(
            target[key] as Record<string, unknown>,
            source[key] as Record<string, unknown>,
          );
        } else {
          Object.assign(target, { [key]: source[key] });
        }
      }
    }

    return this.deepMerge(target, ...sources);
  }

  public static contains(inner: object, container: object): boolean {
    if (typeof inner != typeof container) return false;
    if (Array.isArray(inner) && Array.isArray(container)) {
      // assuming same order at least
      let i;
      let j;
      let la;
      let lb;
      for (i = 0, j = 0, la = inner.length, lb = container.length; i < la && j < lb; j++)
        if (ObjectHelpers.contains(inner[i], container[j])) i++;
      return i == la;
    } else if (Object(inner) === inner) {
      for (const p in inner)
        if (!(p in container && ObjectHelpers.contains(inner[p], container[p]))) return false;
      return true;
    } else return inner === container;
  }
}
