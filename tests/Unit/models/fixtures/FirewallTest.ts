import { Entity, PrimaryGeneratedColumn, Column, getRepository } from "typeorm";
import Model from "../../../../src/models/Model";

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
        await getRepository(FirewallTest).update(this.id, {name: 'onCreate called'});
    }
}