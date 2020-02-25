import { Application } from "../../src/Application";
import { User } from "../../src/models/user/User";
import * as path from 'path';
import { app } from "../../src/fonaments/abstract-application";
import * as fs from "fs";
import moment from "moment";
import cookie from "cookie";
import signature from "cookie-signature";
import { DatabaseService } from "../../src/database/database.service";

export async function runApplication(resetDatabase: boolean = true): Promise<Application> {
    try {
        const application: Application = new Application();
        await application.bootstrap();
        let databaseService: DatabaseService = await application.getService(DatabaseService.name);

        if (resetDatabase) {
            await databaseService.resetMigrations();
            await databaseService.runMigrations();
            await databaseService.feedDefaultData();
        }

        return application;
    } catch(e) {console.error(e);}
}

export function randomString(length: number = 10) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

export function generateSession(user: User): string {
    const session_id: string = randomString(10);
    const session_path: string = path.join(app().config.get('session').files_path, session_id + '.json');

    fs.writeFileSync(session_path, JSON.stringify({
        "cookie": {
            "originalMaxAge": 899998,
            "expires": moment().add(1, 'd').utc(),
            "secure": false,
            "httpOnly": false,
            "path": "/"
        },
        "customer_id": user.customer,
        "user_id": user.id,
        "username": user.username,
        "__lastAccess": moment().valueOf()
    }));

    return session_id;
}

export function attachSession(id: string): string {
    return cookie.serialize(app().config.get('session').name, signature.sign(id, app().config.get('crypt').secret), {});
}

export async function sleep(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
    return;
}

