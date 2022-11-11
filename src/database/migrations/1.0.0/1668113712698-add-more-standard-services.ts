import {MigrationInterface, QueryRunner} from "typeorm";

export class addMoreStandardServices1668113712698 implements MigrationInterface {
    private TCP_services: { id: number, name: string, port: number, comment: string }[] = [
        { id: 20094, name: "elasticsearch", port: 9200, comment: "Elasticsearch" },
        { id: 20095, name: "kibana", port: 5601, comment: "Kibana" },
        { id: 20096, name: "ntopng", port: 3000, comment: "NtopNG" },
        { id: 20097, name: "influxdb", port: 8086, comment: "InfluxDB" },
    ];

    private async getTreeNodes(queryRunner: QueryRunner): Promise<any> {
        const sql = `select SOON.id from fwc_tree SOON 
            inner join fwc_tree FATHER on SOON.id_parent=FATHER.id 
            where FATHER.name='TCP' and FATHER.node_type='SOT' 
            and FATHER.id_obj is null and FATHER.obj_type=2 
            and FATHER.fwcloud is not null 
            and SOON.name='Standard' and SOON.node_type='STD' 
            and SOON.id_obj is null and SOON.obj_type is null 
            and SOON.fwcloud is not null`;
    
        return await queryRunner.query(sql);
    }

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (let service of this.TCP_services) {
            await queryRunner.query(`INSERT INTO ipobj VALUES(${service.id},NULL,NULL,'${service.name}',2,6,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,${service.port},${service.port},NULL,'${service.comment}',NOW(),NOW(),0,0)`);
        }

        // Add new TCP services to the TCP Standard node of al fwcloud's services tree.
        let nodes = await this.getTreeNodes(queryRunner);
        for (let node of nodes) {
            for (let service of this.TCP_services) {
                // Make sure that we don't already have a node for this TCP service.
                let sql = `SELECT id from fwc_tree
                    where id_parent=${node.id} and id_obj=${service.id}`;
                let exists = await queryRunner.query(sql);
                
                // If the node for this service object already exists, then don't create it.
                if (exists.length) {
                    continue;
                }
                
                sql = `INSERT INTO fwc_tree
                    (name, id_parent, node_type, id_obj, obj_type) 
                    VALUES ('${service.name}', ${node.id}, 'SOT', ${service.id}, 2)`
                await queryRunner.query(sql);
            }    
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (var service of this.TCP_services) {
            await queryRunner.query(`DELETE FROM ipobj WHERE id=${service.id}`);
        }

        let nodes = await this.getTreeNodes(queryRunner);
        for (let node of nodes) {
            for (let service of this.TCP_services) {
                await queryRunner.query(`DELETE FROM fwc_tree WHERE id_parent=${node.id} and id_obj=${service.id}`);
            }
        }
    }

}
