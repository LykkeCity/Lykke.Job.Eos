import { TableService, TableQuery } from "azure-storage";
import { fromBase64, toBase64 } from "../common";
import { isString } from "util";

export class QueryResult<T> {

    constructor(azureQueryResult: TableService.QueryEntitiesResult<any>, toT: (e: any) => T) {
        this.items = azureQueryResult.entries.map(toT);
        this.continuation = !!azureQueryResult.continuationToken
            ? toBase64(JSON.stringify(azureQueryResult.continuationToken))
            : null;
    }

    items: T[];
    continuation: string;
}

export function toAzure(continuation: string): TableService.TableContinuationToken {
    return !!continuation
        ? JSON.parse(fromBase64(continuation)) as TableService.TableContinuationToken
        : null;
}

export async function ensureTable(table: TableService, tableName: string): Promise<void> {
    return new Promise<void>((res, rej) => {
        table.createTableIfNotExists(tableName, err => {
            if (err) {
                rej(err);
            } else {
                res();
            }
        });
    });
}

export async function select(table: TableService, tableName: string, partitionKey: string, rowKey: string): Promise<any>;
export async function select(table: TableService, tableName: string, query: TableQuery, continuationToken: TableService.TableContinuationToken): Promise<TableService.QueryEntitiesResult<any>>;
export async function select(table: TableService, tableName: string, partitionKeyOrQuery: string | TableQuery, rowKeyOrContinuationToken: string | TableService.TableContinuationToken): Promise<any | TableService.QueryEntitiesResult<any>> {
    return ensureTable(table, tableName)
        .then(() => {
            return new Promise<any | QueryResult<any>>((res, rej) => {
                if (isString(partitionKeyOrQuery)) {
                    table.retrieveEntity(tableName, partitionKeyOrQuery, rowKeyOrContinuationToken as string, (err, result, response) => {
                        if (err && response.statusCode != 404) {
                            rej(err);
                        } else {
                            res(result);
                        }
                    });
                } else {
                    table.queryEntities(tableName, partitionKeyOrQuery, rowKeyOrContinuationToken as TableService.TableContinuationToken, (err, result, response) => {
                        if (err) {
                            rej(err);
                        } else {
                            res(result);
                        }
                    });
                }
            });
        });
}
