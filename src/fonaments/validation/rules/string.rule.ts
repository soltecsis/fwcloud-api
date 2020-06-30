import { Rule } from "./rule";

export class String extends Rule {
    public async passes(attribute: string, value: any): Promise<boolean> {
        return typeof value === 'string' || value === undefined;
    }

    public message(attribute: string, value: any): string {
        return `${attribute} is not string.`;
    }
}