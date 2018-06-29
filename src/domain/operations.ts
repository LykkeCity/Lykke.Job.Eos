import { TableQuery, date } from "azure-storage";
import { Settings } from "../common";
import { AzureRepository, AzureEntity, Ignore, Int64, Double } from "./azure";

export enum OperationType {
    Single = "Single",
    ManyInputs = "ManyInputs",
    ManyOutputs = "ManyOutputs",
}

export class OperationEntity extends AzureEntity {
    @Ignore()
    get OperationId(): string {
        return this.PartitionKey;
    }

    Type: OperationType;
    AssetId: string;

    @Double()
    Amount: number;

    @Int64()
    AmountInBaseUnit: number;

    BuildTime: Date;
    ExpiryTime: Date;
    SendTime: Date;
    TxId: string;
    CompletionTime: Date;
    BlockTime: Date;

    @Int64()
    Block: number;

    FailTime: Date;
    Error: string;
    DeleteTime: Date;

    isNotBuiltOrDeleted(): boolean {
        return !this.DeleteTime && (this.isSent() || this.isFailed());
    }

    isSent(): boolean {
        return !!this.SendTime;
    }

    isFailed(): boolean {
        return !!this.FailTime;
    }
}

export class OperationActionEntity extends AzureEntity {

    @Ignore()
    get OperationId(): string {
        return this.PartitionKey;
    }

    From: string;
    To: string;

    @Double()
    Amount: number;

    @Int64()
    AmountInBaseUnit: number;
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

export class OperationByTxIdEntity extends AzureEntity {
    @Ignore()
    get TxId(): string {
        return this.PartitionKey;
    }

    OperationId: string;
}

export class OperationRepository extends AzureRepository {

    private operationTableName: string = "EosOperations";
    private operationActionTableName: string = "EosOperationActions";
    private operationByExpiryTimeTableName: string = "EosOperationsByExpiryTime";
    private operationByTxIdTableName: string = "EosOperationsByTxId";

    constructor(private settings: Settings) {
        super(settings.EosJob.AzureConnectionString);
    }

    async upsert(operationId: string, type: OperationType, assetId: string,
        actions: { fromAddress: string, toAddress: string, amount: number, amountInBaseUnit: number }[],
        expiryTime: Date) {

        const operationEntity = new OperationEntity();
        operationEntity.PartitionKey = operationId;
        operationEntity.RowKey = "";
        operationEntity.Type = type;
        operationEntity.AssetId = assetId;
        operationEntity.Amount = actions.reduce((sum, action) => sum + action.amount, 0);
        operationEntity.AmountInBaseUnit = actions.reduce((sum, action) => sum + action.amountInBaseUnit, 0);
        operationEntity.BuildTime = new Date();
        operationEntity.ExpiryTime = expiryTime;

        const operationActionEntities = actions.map((action, i) => {
            const entity = new OperationActionEntity();
            entity.PartitionKey = operationId;
            entity.RowKey = i.toString().padStart(4, "0");
            entity.From = action.fromAddress;
            entity.To = action.toAddress;
            entity.Amount = action.amount;
            entity.AmountInBaseUnit = action.amountInBaseUnit;
            return entity;
        });

        const operationByExpiryTimeEntity = new OperationByExpiryTimeEntity();
        operationByExpiryTimeEntity.PartitionKey = expiryTime.toISOString();
        operationByExpiryTimeEntity.RowKey = operationId;

        await this.insertOrMerge(this.operationTableName, operationEntity);
        await this.insertOrMerge(this.operationActionTableName, operationActionEntities);
        await this.insertOrMerge(this.operationByExpiryTimeTableName, operationByExpiryTimeEntity);
    }

    async update(operationId: string,
        operation: { sendTime?: Date, completionTime?: Date, failTime?: Date, deleteTime?: Date, txId?: string, blockTime?: Date, block?: number, error?: string }) {
        const operationEntity = new OperationEntity();
        operationEntity.PartitionKey = operationId;
        operationEntity.RowKey = "";
        operationEntity.SendTime = operation.sendTime;
        operationEntity.CompletionTime = operation.completionTime;
        operationEntity.FailTime = operation.failTime;
        operationEntity.DeleteTime = operation.deleteTime;
        operationEntity.TxId = operation.txId;
        operationEntity.BlockTime = operation.blockTime;
        operationEntity.Block = operation.block;
        operationEntity.Error = operation.error;

        await this.insertOrMerge(this.operationTableName, operationEntity);
    }

    async get(operationId: string): Promise<OperationEntity> {
        return await this.select(OperationEntity, this.operationTableName, operationId, "");
    }

    async getActions(operationId: string): Promise<OperationActionEntity[]> {
        return await this.selectAll(async (c) => await this.select(OperationActionEntity, this.operationActionTableName, new TableQuery().where("PartitionKey == ?", operationId), c));
    }

    async getOperationIdByTxId(txId: string) {
        const operationByTxIdEntity = await this.select(OperationByTxIdEntity, this.operationByTxIdTableName, txId, "");
        if (!!operationByTxIdEntity) {
            return operationByTxIdEntity.OperationId;
        } else {
            return null;
        }
    }

    async geOperationIdByExpiryTime(from: Date, to: Date): Promise<string[]> {
        const query = new TableQuery()
            .where("PartitionKey > ? and PartitionKey <= ?", from.toISOString(), to.toISOString());

        const entities = await this.selectAll(async (c) => this.select(OperationByExpiryTimeEntity, this.operationByExpiryTimeTableName, query, c));

        return entities.map(e => e.OperationId);
    }
}