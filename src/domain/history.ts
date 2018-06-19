import { Asset } from "./assets";
import { TableService, createTableService, TableQuery, TableUtilities, date } from "azure-storage";
import { Settings } from "../common";
import { ensureTable } from "./queries";

export class HistoryRepository {

    private historyTableName: string = "EosHistory";
    private historyIndexTableName: string = "EosHistoryIndex";
    private table: TableService;

    constructor(private settings: Settings) {
        this.table = createTableService(settings.EosApi.DataConnectionString);
    }

    async upsert(from: string, to: string, amount: number, asset: Asset, blockNum: number, txId: string, actionId: string, operationId?: string): Promise<void> {
        return ensureTable(this.table, this.historyTableName)
            .then(() => ensureTable(this.table, this.historyIndexTableName))
            .then(() => {
                return new Promise<void>((res, rej) => {
                    const historyIndexEntity = {
                        PartitionKey: TableUtilities.entityGenerator.String(txId),
                        Block: TableUtilities.entityGenerator.Int64(blockNum)
                    };
                    this.table.insertOrReplaceEntity(this.historyIndexTableName, historyIndexEntity, (err, result) => {
                        if (err) {
                            rej(err);
                        } else {
                            res();
                        }
                    });
                });
            })
            .then(() => {
                return new Promise<any>((res, rej) => {
                    const historyEntity = {
                        PartitionKey: TableUtilities.entityGenerator.String(`From_${from}`),
                        RowKey: TableUtilities.entityGenerator.String(`${blockNum}_${txId}_${actionId}`),
                        From: TableUtilities.entityGenerator.String(from),
                        To: TableUtilities.entityGenerator.String(to),
                        Amount: TableUtilities.entityGenerator.Double(amount),
                        AssetId: TableUtilities.entityGenerator.String(asset.assetId),
                        TxId: TableUtilities.entityGenerator.String(txId),
                        OperationId: TableUtilities.entityGenerator.Guid(operationId)
                    };
                    this.table.insertOrReplaceEntity(this.historyTableName, historyEntity, (err, result) => {
                        if (err) {
                            rej(err);
                        } else {
                            res(historyEntity);
                        }
                    });
                });
            })
            .then(historyEntity => {
                return new Promise<void>((res, rej) => {
                    historyEntity.PartitionKey._ = `To_${to}`;
                    this.table.insertOrReplaceEntity(this.historyTableName, historyEntity, (err, result) => {
                        if (err) {
                            rej(err);
                        } else {
                            res();
                        }
                    });
                });
            });
    }
}