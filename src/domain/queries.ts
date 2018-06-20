import { TableService, TableQuery, TableUtilities } from "azure-storage";
import { fromBase64, toBase64 } from "../common";
import { isString } from "util";
import { AssertionError } from "assert";

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
        ? JSON.parse(fromBase64(continuation))
        : null;
}

export function ensureTable(table: TableService, tableName: string): Promise<void> {
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

export function remove(table: TableService, tableName: string, partitionKey: string, rowKey: string): Promise<void> {
    return ensureTable(table, tableName)
        .then(() => {
            return new Promise<void>((res, rej) => {
                const entity = {
                    PartitionKey: TableUtilities.entityGenerator.String(partitionKey),
                    RowKey: TableUtilities.entityGenerator.String(rowKey)
                };
                table.deleteEntity(tableName, entity, err => {
                    if (err) {
                        rej(err);
                    } else {
                        res();
                    }
                })
            });
        });
}

export function select(table: TableService, tableName: string, partitionKey: string, rowKey: string, throwIfNotFound?: boolean): Promise<any>;
export function select(table: TableService, tableName: string, query: TableQuery, continuationToken: TableService.TableContinuationToken): Promise<TableService.QueryEntitiesResult<any>>;
export function select(table: TableService, tableName: string, partitionKeyOrQuery: string | TableQuery, rowKeyOrContinuationToken: string | TableService.TableContinuationToken, throwIfNotFound = false): Promise<any | TableService.QueryEntitiesResult<any>> {
    return ensureTable(table, tableName)
        .then(() => {
            return new Promise<any | QueryResult<any>>((res, rej) => {
                if (isString(partitionKeyOrQuery)) {
                    table.retrieveEntity(tableName, partitionKeyOrQuery, rowKeyOrContinuationToken as string, (err, result, response) => {
                        if (err && (response.statusCode != 404 || !!throwIfNotFound)) {
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

export async function all<T>(query: (take: number, continuation?: string) => Promise<QueryResult<T>>): Promise<T[]> {
    let continuation: string = null;
    let items: T[] = [];

    do {
        let res = await query(100, continuation);
        continuation = res.continuation;
        items = items.concat(res.items);
    } while (!!continuation)

    return items;
}
