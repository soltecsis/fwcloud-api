import * as uuid from "uuid";
import { SocketMessage } from "../messages/socket-message";
import { EventEmitter } from "events";
import { Request } from "express";
import io from "socket.io";
import { app } from "../../fonaments/abstract-application";
import { WebSocketService } from "../web-socket.service";

export class Channel extends EventEmitter {
  protected _id: string;
  protected _listener: EventEmitter;

  constructor(id: string, listener: EventEmitter) {
    super();
    this._id = id;
    this._listener = listener;
  }

  get id(): string {
    return this._id;
  }

  public message(payload: object): boolean {
    const message = new SocketMessage(payload, this._id);
    return this._listener.emit(this._id, message);
  }

  public emit(event: string | symbol, ...args: any[]): boolean {
    if (event === "message") {
      return this.message(args[0]);
    }

    return super.emit(event, ...args);
  }

  public static async fromRequest(request: Request): Promise<Channel> {
    if (request.session.socketId && request.inputs.has("channel_id")) {
      const websocketService: WebSocketService =
        await app().getService<WebSocketService>(WebSocketService.name);
      let listener: EventEmitter = new EventEmitter();

      if (websocketService.hasSocket(request.session.socketId)) {
        listener = websocketService.getSocket(request.session.socketId);
      }
      const id: string = request.inputs.get("channel_id", uuid.v1());

      return new Channel(id, listener);
    }

    return new Channel(uuid.v1(), new EventEmitter());
  }
}
