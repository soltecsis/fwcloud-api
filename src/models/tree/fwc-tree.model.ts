import Model from "../Model";
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn } from "typeorm";
import { FwCloud } from "../fwcloud/FwCloud";
import { IPObjType } from "../ipobj/IPObjType";

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
    parent: FwcTree

    @OneToMany(type => FwcTree, fwcTree => fwcTree.parent)
    childs: Array<FwcTree>;

    @ManyToOne(type => IPObjType, ipObjType => ipObjType.fwcTrees)
    @JoinColumn({
        name: 'obj_type'
    })
    ipObjType: IPObjType;


    public getTableName(): string {
        return tableName;
    }

}