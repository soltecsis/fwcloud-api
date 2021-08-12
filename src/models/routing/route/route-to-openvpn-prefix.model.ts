import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import Model from "../../Model";
import { OpenVPNPrefix } from "../../vpn/openvpn/OpenVPNPrefix";
import { Route } from "./route.model";

const tableName: string = 'route__openvpn_prefix';

@Entity(tableName)
export class RouteToOpenVPNPrefix extends Model {
    
    @PrimaryColumn({
        name: 'route'
    })
    routeId: number;

    @PrimaryColumn({
        name: 'openvpn_prefix'
    })
    openVPNPrefixId: number;
    
    @Column({
        type: Number
    })
    order: number;

    @ManyToOne(() => Route, model => model.routeToOpenVPNPrefixes, {
        orphanedRowAction: 'delete'
    })
    @JoinColumn({
        name: 'route'
    })
    route: Route;

    @ManyToOne(() => OpenVPNPrefix, model => model.routeToOpenVPNPrefixes, {
        orphanedRowAction: 'delete'
    })
    @JoinColumn({
        name: 'openvpn_prefix'
    })
    openVPNPrefix: OpenVPNPrefix;

    
    public getTableName(): string {
        return tableName;
    }

}