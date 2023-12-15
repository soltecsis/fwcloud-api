/*!
    Copyright 2023 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPolicyTypes1702633247091 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE policy_type MODIFY type VARCHAR(3)`);

        await queryRunner.query(`
            INSERT INTO policy_type (id, type, name, type_order, show_action) 
            VALUES 
                (105, 'S01', 'DHCP', 6, false),
                (106, 'S02', 'Keepalived', 7, false),
                (107, 'S03', 'HAProxy', 8, false)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM policy_type WHERE id IN (100, 101, 102)
        `);

        await queryRunner.query(`ALTER TABLE policy_type MODIFY type VARCHAR(2)`);
    }
}