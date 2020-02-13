export default class StringHelper {

    /**
     * Camelcased a collection of string
     * 
     * @param words Collection of string to be CamelCased
     */
    public static toCamelCase(...words: string[]): string {
        let result = words.length >= 1 ? words.shift() : "";

        if (words.length > 0) {
            words.forEach((element:string) => {
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
}