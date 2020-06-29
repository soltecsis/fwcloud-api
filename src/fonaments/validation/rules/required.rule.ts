import { Rule } from "./rule";

export class Required extends Rule {
    
    public async passes(attribute: string, value: any): Promise<boolean> {
        if (value === undefined || value === null) {
            return false;
        }

        return true;
    }
    
    public message(attribute: string, value: any): string {
        return `${attribute} is required`;
    }

}