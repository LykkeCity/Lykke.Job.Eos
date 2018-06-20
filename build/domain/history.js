"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const azure_storage_1 = require("azure-storage");
const queries_1 = require("./queries");
class HistoryRepository {
    constructor(settings) {
        this.settings = settings;
        this.historyTableName = "EosHistory";
        this.historyByTxIdTableName = "EosHistoryByTxId";
        this.table = azure_storage_1.createTableService(settings.EosApi.DataConnectionString);
    }
    upsert(from, to, amount, asset, blockNum, txId, actionId, operationId) {
        return queries_1.ensureTable(this.table, this.historyTableName)
            .then(() => queries_1.ensureTable(this.table, this.historyByTxIdTableName))
            .then(() => {
            return new Promise((res, rej) => {
                const historyByTxIdEntity = {
                    PartitionKey: azure_storage_1.TableUtilities.entityGenerator.String(txId),
                    Block: azure_storage_1.TableUtilities.entityGenerator.Int64(blockNum)
                };
                this.table.insertOrReplaceEntity(this.historyByTxIdTableName, historyByTxIdEntity, (err, result) => {
                    if (err) {
                        rej(err);
                    }
                    else {
                        res();
                    }
                });
            });
        })
            .then(() => {
            return new Promise((res, rej) => {
                const historyEntity = {
                    PartitionKey: azure_storage_1.TableUtilities.entityGenerator.String(`From_${from}`),
                    RowKey: azure_storage_1.TableUtilities.entityGenerator.String(`${blockNum}_${txId}_${actionId}`),
                    From: azure_storage_1.TableUtilities.entityGenerator.String(from),
                    To: azure_storage_1.TableUtilities.entityGenerator.String(to),
                    Amount: azure_storage_1.TableUtilities.entityGenerator.Double(amount),
                    AssetId: azure_storage_1.TableUtilities.entityGenerator.String(asset.assetId),
                    TxId: azure_storage_1.TableUtilities.entityGenerator.String(txId),
                    OperationId: azure_storage_1.TableUtilities.entityGenerator.Guid(operationId)
                };
                this.table.insertOrReplaceEntity(this.historyTableName, historyEntity, (err, result) => {
                    if (err) {
                        rej(err);
                    }
                    else {
                        res(historyEntity);
                    }
                });
            });
        })
            .then(historyEntity => {
            return new Promise((res, rej) => {
                historyEntity.PartitionKey._ = `To_${to}`;
                this.table.insertOrReplaceEntity(this.historyTableName, historyEntity, (err, result) => {
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
}
exports.HistoryRepository = HistoryRepository;
//# sourceMappingURL=history.js.map