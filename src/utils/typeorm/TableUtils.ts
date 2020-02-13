import { Table, TableForeignKey, AdvancedConsoleLogger } from "typeorm";

export function findForeignKeyInTable(table: Table, column: string): TableForeignKey | null {
    return table.foreignKeys.find(fk => fk.columnNames.indexOf(column) !== -1);
}