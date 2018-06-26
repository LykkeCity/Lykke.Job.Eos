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

    CompletionTime: Date;
    BlockTime: Date;

    @Int64()
    Block: number;

    FailTime: Date;
    Error: string;

    isNotCompletedOrFailed(): boolean {
        return !this.CompletionTime && !this.FailTime;
    }
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
        super(settings.EosJob.DataConnectionString);
    }

    async updateCompletion(txId: string, blockTime: Date, block: number): Promise<string> {
        const operationByTxIdEntity = await this.select(OperationByTxIdEntity, this.operationByTxIdTableName, txId, "");

        if (!!operationByTxIdEntity) {
            const operationEntity = new OperationEntity();
            operationEntity.PartitionKey = operationByTxIdEntity.OperationId;
            operationEntity.RowKey = "";
            operationEntity.CompletionTime = new Date();
            operationEntity.BlockTime = blockTime;
            operationEntity.Block = block;

            await this.insertOrMerge(this.operationTableName, operationEntity);
        }

        return operationByTxIdEntity && operationByTxIdEntity.OperationId;
    }

    async updateFail(operationId: string, error: string) {
        const operationEntity = new OperationEntity();
        operationEntity.PartitionKey = operationId;
        operationEntity.RowKey = "";
        operationEntity.FailTime = new Date();
        operationEntity.Error = error;

        await this.insertOrMerge(this.operationTableName, operationEntity);
    }

    async handleExpiration(from: Date, to: Date) {
        let continuation: string = null;

        const query = new TableQuery()
            .where("PartitionKey > ? and PartitionKey <= ?", from.toISOString(), to.toISOString());

        do {
            const chunk = await this.select(OperationByExpiryTimeEntity, this.operationByExpiryTimeTableName, query, continuation);

            for (const entity of chunk.items) {
                const operation = await this.select(OperationEntity, this.operationTableName, entity.OperationId, "")
                if (!!operation && operation.isNotCompletedOrFailed()) {
                    await this.updateFail(entity.OperationId, "Transaction expired");
                }
            }

            continuation = chunk.continuation;

        } while (!!continuation)
    }
}