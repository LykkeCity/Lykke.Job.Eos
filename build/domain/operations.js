"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const azure_storage_1 = require("azure-storage");
const queries_1 = require("./queries");
var OperationState;
(function (OperationState) {
    OperationState["Built"] = "Built";
    OperationState["Sent"] = "Sent";
    OperationState["Completed"] = "Completed";
    OperationState["Failed"] = "Failed";
})(OperationState = exports.OperationState || (exports.OperationState = {}));
class OperationRepository {
    constructor(settings) {
        this.settings = settings;
        this.operationTableName = "EosOperations";
        this.operationIndexTableName = "EosOperationIndex";
        this.operationExpirationTableName = "EosOperationExpiration";
        this.table = azure_storage_1.createTableService(settings.EosApi.DataConnectionString);
    }
    async updateCompleted(txId, minedUtc, blockNum) {
        const indexEntity = await queries_1.select(this.table, this.operationIndexTableName, txId, "");
        if (!!indexEntity) {
            const operationEntity = await queries_1.select(this.table, this.operationTableName, indexEntity.PartitionKey._, "");
            if (!!operationEntity) {
                return new Promise((res, rej) => {
                    const operationId = indexEntity.OperationId._;
                    const operationEntity = {
                        PartitionKey: azure_storage_1.TableUtilities.entityGenerator.String(operationId),
                        CompletedUtc: azure_storage_1.TableUtilities.entityGenerator.DateTime(new Date()),
                        MinedUtc: azure_storage_1.TableUtilities.entityGenerator.DateTime(minedUtc),
                        BlockNumber: azure_storage_1.TableUtilities.entityGenerator.Int64(blockNum),
                        State: azure_storage_1.TableUtilities.entityGenerator.String(OperationState.Completed),
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
        }
        return null;
        // return select(this.table, this.operationIndexTableName, txId, "")
        //     .then(indexEntity => {
        //         if (!!indexEntity) {
        //             return new Promise<string>((res, rej) => {
        //                 const operationId = indexEntity.OperationId._;
        //                 const operationEntity = {
        //                     PartitionKey: TableUtilities.entityGenerator.String(operationId),
        //                     CompletedUtc: TableUtilities.entityGenerator.DateTime(new Date()),
        //                     MinedUtc: TableUtilities.entityGenerator.DateTime(minedUtc),
        //                     BlockNumber: TableUtilities.entityGenerator.Int64(blockNum),
        //                     State: TableUtilities.entityGenerator.String(OperationState.Completed),
        //                 };
        //                 this.table.insertOrMergeEntity(this.operationTableName, operationEntity, (err, result) => {
        //                     if (err) {
        //                         rej(err);
        //                     } else {
        //                         res(operationId);
        //                     }
        //                 });
        //             });
        //         } else {
        //             return null;
        //         }
        //     });
    }
    async updateFailed(operationId, failedUtc, error) {
        return queries_1.ensureTable(this.table, this.operationTableName)
            .then(() => {
            return new Promise((res, rej) => {
                const operationEntity = {
                    PartitionKey: azure_storage_1.TableUtilities.entityGenerator.String(operationId),
                    FailedUtc: azure_storage_1.TableUtilities.entityGenerator.DateTime(failedUtc),
                    Error: azure_storage_1.TableUtilities.entityGenerator.String(error),
                    State: azure_storage_1.TableUtilities.entityGenerator.String(OperationState.Failed),
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
    async updateExpired(expiryTime) {
        let continuation = null;
        let query = new azure_storage_1.TableQuery().where(azure_storage_1.TableQuery.stringFilter("PartitionKey", "lt", expiryTime));
        do {
            let res = await queries_1.select(this.table, this.operationExpirationTableName, query, continuation);
            for (const item of res.entries) {
                const operation = await queries_1.select(this.table, this.operationTableName, item.RowKey._, "");
                if (!!operation && (operation.State._ == OperationState.Built || operation.State._ == OperationState.Sent)) {
                    await this.updateFailed(operation.OperationId._, new Date(), "Transaction expired");
                }
                await queries_1.remove(this.table, this.operationExpirationTableName, item.PartitionKey._, item.RowKey._);
            }
            continuation = res.continuationToken;
        } while (!!continuation);
    }
}
exports.OperationRepository = OperationRepository;
//# sourceMappingURL=operations.js.map