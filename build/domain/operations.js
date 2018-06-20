"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const azure_storage_1 = require("azure-storage");
const queries_1 = require("./queries");
const util_1 = require("util");
class OperationRepository {
    constructor(settings) {
        this.settings = settings;
        this.operationTableName = "EosOperations";
        this.operationByTxIdTableName = "EosOperationsByTxId";
        this.operationByExpiryTimeTableName = "EosOperationsByExpiryTime";
        this.table = azure_storage_1.createTableService(settings.EosApi.DataConnectionString);
    }
    updateCompleted(trxId, completedUtc, minedUtc, blockNum) {
        return queries_1.select(this.table, this.operationByTxIdTableName, trxId, "")
            .then(operationByTxIdEntity => {
            if (!!operationByTxIdEntity) {
                return new Promise((res, rej) => {
                    const operationId = operationByTxIdEntity.OperationId._;
                    const operationEntity = {
                        PartitionKey: azure_storage_1.TableUtilities.entityGenerator.String(operationId),
                        CompletedUtc: azure_storage_1.TableUtilities.entityGenerator.DateTime(completedUtc),
                        MinedUtc: azure_storage_1.TableUtilities.entityGenerator.DateTime(minedUtc),
                        BlockNum: azure_storage_1.TableUtilities.entityGenerator.Int64(blockNum)
                    };
                    this.table.insertOrMergeEntity(this.operationTableName, operationEntity, (err, result) => {
                        if (err) {
                            rej(err);
                        }
                        else {
                            res(operationId);
                        }
                    });
                });
            }
            else {
                return null;
            }
        });
    }
    updateFailed(operationId, failedUtc, error) {
        return queries_1.ensureTable(this.table, this.operationTableName)
            .then(() => {
            return new Promise((res, rej) => {
                const operationEntity = {
                    PartitionKey: azure_storage_1.TableUtilities.entityGenerator.String(operationId),
                    FailedUtc: azure_storage_1.TableUtilities.entityGenerator.DateTime(failedUtc),
                    Error: azure_storage_1.TableUtilities.entityGenerator.String(error)
                };
                this.table.insertOrMergeEntity(this.operationTableName, operationEntity, (err, result) => {
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
    async updateExpired(from, to) {
        let continuation = null;
        if (util_1.isDate(from)) {
            from = from.toISOString();
        }
        if (util_1.isDate(to)) {
            to = to.toISOString();
        }
        do {
            const query = new azure_storage_1.TableQuery()
                .where("PartitionKey > ? and PartitionKey <= ?", from, to);
            const chunk = await queries_1.select(this.table, this.operationByExpiryTimeTableName, query, continuation);
            const errorMessage = "Transaction expired";
            for (const entry of chunk.entries) {
                const operation = await queries_1.select(this.table, this.operationTableName, entry.RowKey._, "");
                if (!!operation &&
                    (!operation.CompletedUtc || !operation.CompletedUtc._) &&
                    (!operation.DeletedUtc || !operation.DeletedUtc._)) {
                    await this.updateFailed(entry.RowKey._, new Date(), errorMessage);
                }
            }
            continuation = chunk.continuationToken;
        } while (!!continuation);
    }
}
exports.OperationRepository = OperationRepository;
//# sourceMappingURL=operations.js.map