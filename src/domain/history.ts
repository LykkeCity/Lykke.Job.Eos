import { AssetEntity } from "./assets";
import { Settings } from "../common";
import { AzureEntity, AzureRepository, Ignore, Int64, Double } from "./queries";

export class HistoryEntity extends AzureEntity {
    From: string;
    To: string;
    AssetId: string;
    TxId: string;
    OperationId: string;

    @Double()
    Amount: number;
}

export class HistoryByTxIdEntity extends AzureEntity {

    @Ignore()
    get TxId(): string {
        return this.PartitionKey;
    }

    @Int64()
    BlockNum: number;
}

export class HistoryRepository extends AzureRepository {

    private historyTableName: string = "EosHistory";
    private historyByTxIdTableName: string = "EosHistoryByTxId";

    constructor(private settings: Settings) {
        super(settings.EosJob.DataConnectionString);
    }

    async upsert(from: string, to: string, amount: number, asset: AssetEntity, blockNum: number, txId: string, actionId: string, operationId?: string): Promise<void> {

        const historyByTxIdEntity = new HistoryByTxIdEntity();
        historyByTxIdEntity.PartitionKey = txId;
        historyByTxIdEntity.RowKey = "";
        historyByTxIdEntity.BlockNum = blockNum;

        await this.insertOrMerge(this.historyByTxIdTableName, historyByTxIdEntity);

        const historyEntity = new HistoryEntity();
        historyEntity.PartitionKey = `From_${from}`;
        historyEntity.RowKey = `${blockNum}_${txId}_${actionId}`;
        historyEntity.From = from;
        historyEntity.To = to;
        historyEntity.Amount = amount;
        historyEntity.AssetId = asset.AssetId;
        historyEntity.TxId = txId;
        historyEntity.OperationId = operationId;

        await this.insertOrMerge(this.historyTableName, historyEntity);

        historyEntity.PartitionKey = `To_${to}`;

        await this.insertOrMerge(this.historyTableName, historyEntity);
    }
}