"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const azure_storage_1 = require("azure-storage");
const common_1 = require("../common");
const util_1 = require("util");
class QueryResult {
    constructor(azureQueryResult, toT) {
        this.items = azureQueryResult.entries.map(toT);
        this.continuation = !!azureQueryResult.continuationToken
            ? common_1.toBase64(JSON.stringify(azureQueryResult.continuationToken))
            : null;
    }
}
exports.QueryResult = QueryResult;
function fromAzure(entity) {
    for (const key in entity) {
        if (entity.hasOwnProperty(key)) {
            console.log(key);
            if (!!entity[key] && entity[key].hasOwnProperty("_")) {
                switch (entity[key].EdmMetadata) {
                }
            }
        }
    }
    return entity;
}
exports.fromAzure = fromAzure;
function toAzure(continuation) {
    return !!continuation
        ? JSON.parse(common_1.fromBase64(continuation))
        : null;
}
exports.toAzure = toAzure;
function ensureTable(table, tableName) {
    return new Promise((res, rej) => {
        table.createTableIfNotExists(tableName, err => {
            if (err) {
                rej(err);
            }
            else {
                res();
            }
        });
    });
}
exports.ensureTable = ensureTable;
function remove(table, tableName, partitionKey, rowKey) {
    return ensureTable(table, tableName)
        .then(() => {
        return new Promise((res, rej) => {
            const entity = {
                PartitionKey: azure_storage_1.TableUtilities.entityGenerator.String(partitionKey),
                RowKey: azure_storage_1.TableUtilities.entityGenerator.String(rowKey)
            };
            table.deleteEntity(tableName, entity, err => {
                if (err) {
                    rej(err);
                }
                else {
                    res();
                }
            });
        });
    });
}
exports.remove = remove;
function select(table, tableName, partitionKeyOrQuery, rowKeyOrContinuationToken, throwIfNotFound = false) {
    return ensureTable(table, tableName)
        .then(() => {
        return new Promise((res, rej) => {
            if (util_1.isString(partitionKeyOrQuery)) {
                table.retrieveEntity(tableName, partitionKeyOrQuery, rowKeyOrContinuationToken, (err, result, response) => {
                    if (err && (response.statusCode != 404 || !!throwIfNotFound)) {
                        rej(err);
                    }
                    else {
                        res(fromAzure(result));
                    }
                });
            }
            else {
                table.queryEntities(tableName, partitionKeyOrQuery, rowKeyOrContinuationToken, (err, result, response) => {
                    if (err) {
                        rej(err);
                    }
                    else {
                        res(result);
                    }
                });
            }
        });
    });
}
exports.select = select;
async function all(query) {
    let continuation = null;
    let items = [];
    do {
        let res = await query(100, continuation);
        continuation = res.continuation;
        items = items.concat(res.items);
    } while (!!continuation);
    return items;
}
exports.all = all;
//# sourceMappingURL=queries.js.map