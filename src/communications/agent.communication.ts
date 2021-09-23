import { EventEmitter } from "events";
import { Communication } from "./communication";

type AgentCommunicationData = {
    protocol: 'https' | 'http',
    host: string,
    port: number,
    apikey: string
}

export class AgentCommunication extends Communication<AgentCommunicationData> {
    
    install(scriptPath: string, eventEmitter?: EventEmitter): Promise<string> {
        throw new Error("Method not implemented.");
    }
    
    ping(): Promise<void> {
        throw new Error("Method not implemented.");
    }
}