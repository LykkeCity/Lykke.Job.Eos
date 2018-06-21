import { TableQuery } from "azure-storage";
import { Settings } from "../common";
import { AzureRepository, AzureEntity, Ignore, Int64 } from "./queries";
import { isDate } from "util";

export class OperationByTxIdEntity extends AzureEntity {
    @Ignore()
    get TxId(): string {
        return this.PartitionKey;
    }

    OperationId: string;
}

export class OperationEntity extends AzureEntity {
    @Ignore()
    get OperationId(): string {
        return this.PartitionKey;
    }

    CompletedUtc?: Date;
    MinedUtc?: Date;
    FailedUtc?: Date;

    @Int64()
    BlockNum?: number;
}

export class OperationByExpiryTimeEntity extends AzureEntity {
    @Ignore()
    get ExpiryTime(): Date {
        return new Date(this.PartitionKey);
    }

    @Ignore()
    get OperationId(): string {
        return this.RowKey;
    }
}

export class OperationRepository extends AzureRepository {

    private operationTableName: string = "EosOperations";
    private operationByTxIdTableName: string = "EosOperationsByTxId"
    private operationByExpiryTimeTableName: string = "EosOperationsByExpiryTime";

    constructor(private settings: Settings) {
        super(settings.EosApi.DataConnectionString);
    }

    async updateCompleted(trxId: string, completedUtc: Date, minedUtc: Date, blockNum: number): Promise<string> {
        const operationByTxIdEntity = await this.select(OperationByTxIdEntity, this.operationByTxIdTableName, trxId, "");

        if (!!operationByTxIdEntity) {
            const operationEntity = new OperationEntity();
            operationEntity.PartitionKey = operationByTxIdEntity.OperationId;
            operationEntity.RowKey = "";
            operationEntity.CompletedUtc = completedUtc;
            operationEntity.MinedUtc = minedUtc;
            operationEntity.BlockNum = blockNum;

            await this.insertOrMerge(this.operationTableName, operationEntity);
        }

        return operationByTxIdEntity && operationByTxIdEntity.OperationId;
    }

    async updateFailed(operationId: string, failedUtc: Date, error: string): Promise<void> {
        const operationEntity = new OperationEntity();
        operationEntity.PartitionKey = operationId;
        operationEntity.RowKey = "";
        operationEntity.FailedUtc = failedUtc;
        operationEntity.Error = error;

        await this.insertOrMerge(this.operationTableName, operationEntity);
    }

    async updateExpired(from: Date, to: Date) {
        let continuation: string = null;

        do {
            const query: TableQuery = new TableQuery().where("PartitionKey > ? and PartitionKey <= ?", from.toISOString(), to.toISOString());
            const chunk = await this.select(OperationByExpiryTimeEntity, this.operationByExpiryTimeTableName, query, continuation);

            for (const entity of chunk.items) {
                const operation = await this.select(OperationEntity, this.operationTableName, entity.OperationId, "")

                if (!!operation && !operation.CompletedUtc && !operation.FailedUtc) {
                    await this.updateFailed(entity.OperationId, entity.ExpiryTime, "Transaction expired");
                }
            }

            continuation = chunk.continuation;

        } while (!!continuation)
    }
}