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

export default class StringHelper {

    /**
     * Camelcased a collection of string
     * 
     * @param words Collection of string to be CamelCased
     */
    public static toCamelCase(...words: string[]): string {
        let result = words.length >= 1 ? words.shift() : "";

        if (words.length > 0) {
            words.forEach((element: string) => {
                result = result + StringHelper.capitalize(element);
            })
        }

        return result;
    }

    /**
     * Capitalize an string
     * 
     * @param word string to be capitalized
     */
    public static capitalize(word: string): string {
        return word.charAt(0).toUpperCase() + word.slice(1);
    }

    public static after(pattern: string, text: string): string {
        const splitted: Array<string> = text.split(pattern);

        return splitted[splitted.length - 1];
    }

    public static randomize(length: number = 50): string {
        var result = '';
        var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        var charactersLength = characters.length;
        for (var i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }
}