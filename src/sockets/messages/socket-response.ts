import { SocketMessage } from "./socket-message";

export type ErrorResponsePayload = {
    error: string
}

export type ResponsePayload = { }

export class SocketResponse extends SocketMessage {
    payload: ErrorResponsePayload | ResponsePayload
}