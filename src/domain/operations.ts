import { TableService, TableUtilities, createTableService, TableQuery } from "azure-storage";
import { Settings } from "../common";
import { select, toAzure, remove, ensureTable } from "./queries";
import { isString, isDate } from "util";

export class OperationRepository {

    private operationTableName: string = "EosOperations";
    private operationByTxIdTableName: string = "EosOperationsByTxId"
    private operationByExpiryTimeTableName: string = "EosOperationsByExpiryTime";
    private table: TableService;

    constructor(private settings: Settings) {
        this.table = createTableService(settings.EosApi.DataConnectionString);
    }

    updateCompleted(trxId: string, completedUtc: Date | string, minedUtc: Date | string, blockNum: number): Promise<string> {
        return select(this.table, this.operationByTxIdTableName, trxId, "")
            .then(operationByTxIdEntity => {
                if (!!operationByTxIdEntity) {
                    return new Promise<string>((res, rej) => {
                        const operationId = operationByTxIdEntity.OperationId._;
                        const operationEntity = {
                            PartitionKey: TableUtilities.entityGenerator.String(operationId),
                            CompletedUtc: TableUtilities.entityGenerator.DateTime(completedUtc),
                            MinedUtc: TableUtilities.entityGenerator.DateTime(minedUtc),
                            BlockNum: TableUtilities.entityGenerator.Int64(blockNum)
                        };
                        this.table.insertOrMergeEntity(this.operationTableName, operationEntity, (err, result) => {
                            if (err) {
                                rej(err);
                            } else {
                                res(operationId);
                            }
                        });
                    });
                } else {
                    return null;
                }
            });
    }

    updateFailed(operationId: string, failedUtc: Date | string, error: string): Promise<void> {
        return ensureTable(this.table, this.operationTableName)
            .then(() => {
                return new Promise<void>((res, rej) => {
                    const operationEntity = {
                        PartitionKey: TableUtilities.entityGenerator.String(operationId),
                        FailedUtc: TableUtilities.entityGenerator.DateTime(failedUtc),
                        Error: TableUtilities.entityGenerator.String(error)
                    };
                    this.table.insertOrMergeEntity(this.operationTableName, operationEntity, (err, result) => {
                        if (err) {
                            rej(err);
                        } else {
                            res();
                        }
                    });
                });
            });
    }

    async updateExpired(from: Date | string, to: Date | string) {
        let continuation: TableService.TableContinuationToken = null;

        if (isDate(from)) {
            from = from.toISOString();
        }

        if (isDate(to)) {
            to = to.toISOString();
        }

        do {
            const query: TableQuery = new TableQuery()
                .where("PartitionKey > ? and PartitionKey <= ?", from, to);
            const chunk = await select(this.table, this.operationByExpiryTimeTableName, query, continuation);
            const errorMessage = "Transaction expired";

            for (const entry of chunk.entries) {
                const operation = await select(this.table, this.operationTableName, entry.RowKey._, "")

                if (!!operation &&
                    (!operation.CompletedUtc || !operation.CompletedUtc._) &&
                    (!operation.DeletedUtc || !operation.DeletedUtc._)) {
                    await this.updateFailed(entry.RowKey._, new Date(), errorMessage);
                }
            }

            continuation = chunk.continuationToken;

        } while (!!continuation)
    }
}