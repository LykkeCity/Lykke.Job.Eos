"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const azure_storage_1 = require("azure-storage");
const common_1 = require("../common");
const util_1 = require("util");
require("reflect-metadata");
const azureEdmMetadataKey = Symbol("Azure.Edm");
const azureIgnoreMetadataKey = Symbol("Azure.Ignore");
const int64EdmMetadataKey = "Edm.Int64";
const int32EdmMetadataKey = "Edm.Int32";
const doubleEdmMetadataKey = "Edm.Double";
function Ignore() {
    return (target, propertyKey) => Reflect.defineMetadata(azureIgnoreMetadataKey, true, target, propertyKey);
}
exports.Ignore = Ignore;
function Int64() {
    return (target, propertyKey) => Reflect.defineMetadata(azureEdmMetadataKey, int64EdmMetadataKey, target, propertyKey);
}
exports.Int64 = Int64;
function Int32() {
    return (target, propertyKey) => Reflect.defineMetadata(azureEdmMetadataKey, int32EdmMetadataKey, target, propertyKey);
}
exports.Int32 = Int32;
function Double() {
    return (target, propertyKey) => Reflect.defineMetadata(azureEdmMetadataKey, int64EdmMetadataKey, target, propertyKey);
}
exports.Double = Double;
class AzureEntity {
}
exports.AzureEntity = AzureEntity;
class AzureQueryResult {
    constructor(azureQueryResult, toT) {
        this.items = azureQueryResult.entries.map(toT);
        this.continuation = !!azureQueryResult.continuationToken
            ? common_1.toBase64(JSON.stringify(azureQueryResult.continuationToken))
            : null;
    }
}
exports.AzureQueryResult = AzureQueryResult;
class AzureRepository {
    constructor(connectionString) {
        this.table = azure_storage_1.createTableService(connectionString);
    }
    fromAzure(entity, t) {
        if (!!entity) {
            const result = new t();
            for (const key in entity) {
                if (entity.hasOwnProperty(key)) {
                    if (!!entity[key] && entity[key].hasOwnProperty("_")) {
                        switch (entity[key].$) {
                            case "Edm.DateTime":
                                result[key] = new Date(entity[key]._);
                                break;
                            case "Edm.Int32":
                            case "Edm.Int64":
                                result[key] = parseInt(entity[key]._);
                                break;
                            case "Edm.Double":
                                result[key] = parseFloat(entity[key]._);
                                break;
                            default:
                                result[key] = entity[key]._;
                                break;
                        }
                    }
                    else {
                        result[key] = entity[key];
                    }
                }
            }
            return result;
        }
        else {
            return entity; // null | undefined
        }
    }
    toAzure(entityOrContinuationToken) {
        if (!entityOrContinuationToken) {
            return null;
        }
        if (util_1.isString(entityOrContinuationToken)) {
            return JSON.parse(common_1.fromBase64(entityOrContinuationToken));
        }
        else {
            const entity = {
                ".metadata": entityOrContinuationToken[".metadata"]
            };
            for (const key in entityOrContinuationToken) {
                if (key != ".metadata" && !Reflect.getMetadata(azureIgnoreMetadataKey, entityOrContinuationToken, key)) {
                    entity[key] = {
                        _: entityOrContinuationToken[key],
                        $: Reflect.getMetadata(azureEdmMetadataKey, entityOrContinuationToken, key)
                    };
                }
            }
            return entity;
        }
    }
    ensureTable(tableName) {
        return new Promise((res, rej) => {
            this.table.createTableIfNotExists(tableName, err => {
                if (err) {
                    rej(err);
                }
                else {
                    res();
                }
            });
        });
    }
    remove(tableName, partitionKey, rowKey) {
        return this.ensureTable(tableName)
            .then(() => {
            return new Promise((res, rej) => {
                const entity = {
                    PartitionKey: azure_storage_1.TableUtilities.entityGenerator.String(partitionKey),
                    RowKey: azure_storage_1.TableUtilities.entityGenerator.String(rowKey)
                };
                this.table.deleteEntity(tableName, entity, err => {
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
    select(t, tableName, partitionKeyOrQuery, rowKeyOrContinuation, throwIfNotFound = false) {
        return this.ensureTable(tableName)
            .then(() => {
            return new Promise((res, rej) => {
                if (util_1.isString(partitionKeyOrQuery)) {
                    this.table.retrieveEntity(tableName, partitionKeyOrQuery, rowKeyOrContinuation, (err, result, response) => {
                        if (err && (response.statusCode != 404 || !!throwIfNotFound)) {
                            rej(err);
                        }
                        else {
                            res(this.fromAzure(result, t));
                        }
                    });
                }
                else {
                    this.table.queryEntities(tableName, partitionKeyOrQuery, this.toAzure(rowKeyOrContinuation), (err, result) => {
                        if (err) {
                            rej(err);
                        }
                        else {
                            res(new AzureQueryResult(result, e => this.fromAzure(e, t)));
                        }
                    });
                }
            });
        });
    }
    insertOrMerge(tableName, entity) {
        return this.ensureTable(tableName)
            .then(() => {
            return new Promise((res, rej) => {
                this.table.insertOrMergeEntity(tableName, this.toAzure(entity), err => {
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
    /**
     * Fetches all entities chunk by chunk.
     * @param query Performs actual query, must accept continuation
     */
    async selectAll(query) {
        let continuation = null;
        let items = [];
        do {
            const res = await query(continuation);
            continuation = res.continuation;
            items = items.concat(res.items);
        } while (!!continuation);
        return items;
    }
}
exports.AzureRepository = AzureRepository;
//# sourceMappingURL=queries.js.map