import { Application } from '../Application';
import { Server } from '../Server';

async function loadApplication(): Promise<Application> {
    const application = new Application();
    await application.bootstrap();
    return application;
}

function startServer(app: Application): Server {
    const server: Server = new Server(app);
    server.start();

    return server;
}


async function start() {
    const app = await loadApplication();

    const server: Server = startServer(app);
}


start();