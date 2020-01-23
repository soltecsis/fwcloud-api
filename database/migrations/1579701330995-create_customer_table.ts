import {MigrationInterface, QueryRunner, Table} from "typeorm";

export class createCustomerTable1579701330995 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        //customer
        await queryRunner.createTable(new Table({
            name: 'customer',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    isGenerated: true,
                    generationStrategy: 'increment',
                    isPrimary: true,
                },
                {
                    name: 'name',
                    type: 'varchar',
                    isNullable: false
                },
                {
                    name: 'addr',
                    type: 'varchar',
                    isNullable: true,
                    default: null
                },
                {
                    name: 'phone',
                    type: 'varchar',
                    isNullable: true,
                    default: null
                },
                {
                    name: 'email',
                    type: 'varchar',
                    isNullable: true,
                    default: null
                },
                {
                    name: 'web',
                    type: 'varchar',
                    isNullable: true,
                    default: null
                },
                {
                    name: 'created_at',
                    type: 'datetime',
                    isNullable: false,
                    default: "CURRENT_TIMESTAMP"
                },
                {
                    name: 'updated_at',
                    type: 'datetime',
                    isNullable: false,
                    default: 'CURRENT_TIMESTAMP',
                    onUpdate: 'CURRENT_TIMESTAMP',
                },
                {
                    name: 'created_by',
                    type: 'int',
                    isNullable: false,
                    default: 0,
                },
                {
                    name: 'updated_by',
                    type: 'int',
                    isNullable: false,
                    default: 0,
                }
            ],
        }), true);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable('customer', true);
    }

}
