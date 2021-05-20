import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Firewall } from "../../firewall/Firewall";
import Model from "../../Model";
import { Route } from "../route/route.model";

const tableName: string = 'route_g';

@Entity(tableName)
export class RouteGroup extends Model {
    
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string

    @Column()
    comment: string;

    @Column({
        name: 'firewall'
    })
    firewallId: number;

    @ManyToOne(type => Firewall, model => model.routeGroups)
    @JoinColumn({
        name: 'firewall'
    })
    firewall: Firewall;

    @OneToMany(type => Route, model => model.routeGroup, {
        eager: true
    })
    routes: Route[];

    
    public getTableName(): string {
        return tableName;
    }

    toJSON(): any {
        return this;
    } 
    
}