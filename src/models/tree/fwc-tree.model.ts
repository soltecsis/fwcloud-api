import Model from "../Model";
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn } from "typeorm";
import { FwCloud } from "../fwcloud/FwCloud";

const tableName: string = 'fwc_tree';

@Entity(tableName)
export class FwcTree extends Model {
    
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column()
    node_order: number;

    @Column()
    node_type: string

    id_obj;

    obj_type;

    @ManyToOne(type => FwCloud, fwcloud => fwcloud.fwcTrees)
    @JoinColumn({
        name: 'fwcloud'
    })
    fwCloud: FwCloud;

    @ManyToOne(type => FwcTree, fwcTree => fwcTree.childs)
    @JoinColumn({
        name: 'id_parent'
    })
    id_parent: FwcTree

    @OneToMany(type => FwcTree, fwcTree => fwcTree.id_parent)
    childs: Array<FwcTree>;


    public getTableName(): string {
        return tableName;
    }

}