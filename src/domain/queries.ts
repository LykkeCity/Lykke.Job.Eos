import { TableService, TableQuery, TableUtilities } from "azure-storage";
import { fromBase64, toBase64 } from "../common";
import { isString } from "util";
import { AssertionError } from "assert";

export class AzureEntity {
    PartitionKey: string;
    RowKey: string;
    [key: string]: any;
}

export class QueryResult<T extends AzureEntity> {

    constructor(azureQueryResult: TableService.QueryEntitiesResult<any>, toT: (e: any) => T) {
        this.items = azureQueryResult.entries.map(toT);
        this.continuation = !!azureQueryResult.continuationToken
            ? toBase64(JSON.stringify(azureQueryResult.continuationToken))
            : null;
    }

    items: T[];
    continuation: string;
}

export function fromAzure<T extends AzureEntity>(entity: any, t: new () => T): T {
    if (!!entity) {
        const result = new t();
        for (const key in entity) {
            if (entity.hasOwnProperty(key)) {
                console.log(key);
                if (!!entity[key] && entity[key].hasOwnProperty("_") && entity[key].hasOwnProperty("$")) {
                    switch (entity[key].$) {
                        case "Edm.DateTime":
                            result[key] = new Date(entity[key]._)
                            break;
                        case "Edm.Int32":
                        case "Edm.Int64":
                            result[key] = parseInt(entity[key]._)
                            break;
                        case "Edm.Double":
                            result[key] = parseFloat(entity[key]._)
                            break;
                        default:
                            result[key] = entity[key]._;
                            break;
                    }
                } else {
                    result[key] = entity[key];
                }
            }
        }
        return result;
    } else {
        return entity; // null | undefined
    }
}
export function toAzure(entity: any): any;
export function toAzure(continuationToken: string): TableService.TableContinuationToken;
export function toAzure(entityOrContinuationToken: any | string): any | TableService.TableContinuationToken {
    if (!!entityOrContinuationToken) {
        return null;
    }
    if (isString(entityOrContinuationToken)) {
        return JSON.parse(fromBase64(entityOrContinuationToken));
    } else {
        const entity: any = {};
        for (const key in entityOrContinuationToken) {
            if (entityOrContinuationToken.hasOwnProperty(key)) {
                entity[key] = key == ".metadata" ? entityOrContinuationToken[key] : { _: entityOrContinuationToken[key] };
            }
        }
        return entity;
    }
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

export function select<T extends AzureEntity>(t: new () => T, table: TableService, tableName: string, partitionKey: string, rowKey: string, throwIfNotFound?: boolean): Promise<T>;
export function select<T extends AzureEntity>(t: new () => T, table: TableService, tableName: string, query: TableQuery, continuation: string): Promise<QueryResult<T>>;
export function select<T extends AzureEntity>(t: new () => T, table: TableService, tableName: string, partitionKeyOrQuery: string | TableQuery, rowKeyOrContinuation: string, throwIfNotFound = false): Promise<T | QueryResult<T>> {
    return ensureTable(table, tableName)
        .then(() => {
            return new Promise<any | QueryResult<any>>((res, rej) => {
                if (isString(partitionKeyOrQuery)) {
                    table.retrieveEntity(tableName, partitionKeyOrQuery, rowKeyOrContinuation, (err, result, response) => {
                        if (err && (response.statusCode != 404 || !!throwIfNotFound)) {
                            rej(err);
                        } else {
                            res(fromAzure(result, t));
                        }
                    });
                } else {
                    table.queryEntities(tableName, partitionKeyOrQuery, toAzure(rowKeyOrContinuation), (err, result, response) => {
                        if (err) {
                            rej(err);
                        } else {
                            res(new QueryResult(result, e => fromAzure<T>(e, t)));
                        }
                    });
                }
            });
        });
}

/**
 * Fetches all entities chunk by chunk.
 * @param query Performs actual query, must accept continuation
 */
export async function all<T extends AzureEntity>(query: (c: string) => Promise<QueryResult<T>>): Promise<T[]> {
    let continuation: string = null;
    let items: T[] = [];

    do {
        const res = await query(continuation);
        continuation = res.continuation;
        items = items.concat(res.items);
    } while (!!continuation)

    return items;
}
