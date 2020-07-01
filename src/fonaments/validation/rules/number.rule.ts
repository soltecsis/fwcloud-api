import { Rule } from "./rule";

export class Number extends Rule {
    public async passes(attribute: string, value: any): Promise<boolean> {
        return typeof value === 'number';
    }
    public message(attribute: string, value: any): string {
        return `${attribute} is not a number.`
    }

}