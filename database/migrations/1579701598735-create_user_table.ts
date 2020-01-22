import {MigrationInterface, QueryRunner, Table} from "typeorm";

export class createUserTable1579701598735 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<any> {
        //user
        await queryRunner.createTable(new Table({
            name: 'user',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    length: '11',
                    isPrimary: true,
                    generationStrategy: 'increment'
                },
                {
                    name: 'customer',
                    type: 'int',
                    length: '11',
                    default: null
                },
                {
                    name: 'name',
                    type: 'varchar',
                    length: '255',
                    default: null
                },
                {
                    name: 'email',
                    type: 'varchar',
                    length: '255',
                    default: null
                },
                {
                    name: 'username',
                    type: 'varchar',
                    length: '255',
                    default: null
                },
                {
                    name: 'password',
                    type: 'varchar',
                    length: '255',
                    default: null
                },
                {
                    name: 'enabled',
                    type: 'tinyint',
                    length: '1',
                    isNullable: false,
                    default: 1
                },
                {
                    name: 'role',
                    type: 'tinyint',
                    isNullable: false,
                    default: 1
                },
                {
                    name: 'allowed_from',
                    type: 'varchar',
                    length: '255',
                    default: null
                },
                {
                    name: 'last_login',
                    type: 'datetime',
                    default: null
                },
                {
                    name: 'confirmation_token',
                    type: 'varchar',
                    length: '255',
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
            uniques: [
                { columnNames: ['customer', 'username'] }
            ],
            indices: [
                { columnNames: ['customer']}
            ]
        }));

        //user__fwcloud
        await queryRunner.createTable(new Table({
            name: 'user__fwcloud',
            columns: [
                {
                    name: 'user',
                    type: 'int',
                    length: '11',
                    isPrimary: true
                },
                {
                    name: 'fwcloud',
                    type: 'int',
                    length: '11',
                    isPrimary: true
                }
            ],
            indices: [
                { columnNames: ['user'] },
                { columnNames: ['fwcloud'] },
            ]
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable('user', true);
        await queryRunner.dropTable('user__fwcloud', true);
    }

}
