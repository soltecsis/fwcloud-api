import { Entity, PrimaryGeneratedColumn, Column, getRepository } from "typeorm";
import Model from "../../../../src/models/Model";
import { app } from "../../../../src/fonaments/abstract-application";
import { RepositoryService } from "../../../../src/database/repository.service";

@Entity('firewall')
export class FirewallTest extends Model {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    public getTableName(): string {
        throw new Error("Method not implemented.");
    }

    public async onCreate()  {
        const repository: RepositoryService = await app().getService<RepositoryService>(RepositoryService.name)
        await repository.for(FirewallTest).update(this.id, {name: 'onCreate called'});
    }
}