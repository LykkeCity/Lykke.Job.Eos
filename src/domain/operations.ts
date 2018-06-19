import { TableService, TableUtilities, createTableService, TableQuery } from "azure-storage";
import { Settings } from "../common";
import { select, toAzure, remove, ensureTable } from "./queries";

export enum OperationState {
    Built = "Built",
    Sent = "Sent",
    Completed = "Completed",
    Failed = "Failed"
}

export class OperationRepository {

    private operationTableName: string = "EosOperations";
    private operationIndexTableName: string = "EosOperationIndex"
    private operationExpirationTableName: string = "EosOperationExpiration";
    private table: TableService;

    constructor(private settings: Settings) {
        this.table = createTableService(settings.EosApi.DataConnectionString);
    }

    async updateCompleted(txId: string, minedUtc: Date | string, blockNum: number): Promise<string> {
        return select(this.table, this.operationIndexTableName, txId, "")
            .then(indexEntity => {
                if (!!indexEntity) {
                    return new Promise<string>((res, rej) => {
                        const operationId = indexEntity.OperationId._;
                        const operationEntity = {
                            PartitionKey: TableUtilities.entityGenerator.String(operationId),
                            CompletedUtc: TableUtilities.entityGenerator.DateTime(new Date()),
                            MinedUtc: TableUtilities.entityGenerator.DateTime(minedUtc),
                            BlockNumber: TableUtilities.entityGenerator.Int64(blockNum),
                            State: TableUtilities.entityGenerator.String(OperationState.Completed),
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

    async updateFailed(operationId: string, failedUtc: Date | string, error: string): Promise<void> {
        return ensureTable(this.table, this.operationTableName)
            .then(() => {
                return new Promise<void>((res, rej) => {
                    const operationEntity = {
                        PartitionKey: TableUtilities.entityGenerator.String(operationId),
                        FailedUtc: TableUtilities.entityGenerator.DateTime(failedUtc),
                        Error: TableUtilities.entityGenerator.String(error),
                        State: TableUtilities.entityGenerator.String(OperationState.Failed),
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

    async updateExpired(expiryTime: string) {

        let continuation: TableService.TableContinuationToken = null;
        let query: TableQuery = new TableQuery().where(TableQuery.stringFilter("PartitionKey", "lt", expiryTime));

        do {
            let res = await select(this.table, this.operationExpirationTableName, query, continuation);

            for (const item of res.entries) {
                const operation = await select(this.table, this.operationTableName, item.RowKey._, "")

                if (!!operation && (operation.State._ == OperationState.Built || operation.State._ == OperationState.Sent)) {
                    await this.updateFailed(operation.OperationId._, new Date(), "Transaction expired");
                }

                await remove(this.table, this.operationExpirationTableName, item.PartitionKey._, item.RowKey._);
            }

            continuation = res.continuationToken;

        } while (!!continuation)
    }
}