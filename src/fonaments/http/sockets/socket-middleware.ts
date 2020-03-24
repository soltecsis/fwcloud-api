import { AbstractApplication } from "../../abstract-application";
import { Request, Response, NextFunction } from "express";
import { Socket } from "socket.io";

export abstract class SocketMiddleware {
    protected app: AbstractApplication;

    public abstract handle(socket: Socket, next: NextFunction): void;

    private safeHandler(socket: Socket, next: NextFunction) {
        try {
            this.handle(socket, next);
        } catch (e) {
            console.error(e);
            throw e;
        }
    }

    public register(app: AbstractApplication) {
        this.app = app;
        
        app.socketio.use((socket: Socket, next: NextFunction) => {
            this.safeHandler(socket, next);
        })
    }
}