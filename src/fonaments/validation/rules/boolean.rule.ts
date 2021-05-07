import { Rule } from "./rule";

export class Boolean extends Rule {
    public async passes(attribute: string, value: any): Promise<boolean> {
        return typeof value === 'boolean' || value === undefined || value === null;
    }

    public message(attribute: string, value: any): string {
        return `${attribute} is not a boolean.`;
    }
}