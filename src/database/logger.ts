import {Logger, QueryRunner, FileLogger} from "typeorm";
import winston from "winston";
import { logger } from "../fonaments/abstract-application";

export class DatabaseLogger extends FileLogger {

    protected write(strings: string|string[]) {
        strings = Array.isArray(strings) ? strings : [strings];
        
        for(let i = 0; i < strings.length; i++) {
            logger().debug(strings[i]);
        }
    }

}