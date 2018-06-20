import { createTableService, TableService, TableUtilities } from "azure-storage";
import { Settings } from "../common";
import { select, ensureTable } from "./queries";

export interface Params {
    nextActionSequence: number;
    lastProcessedBlockTimestamp: Date;
}

export class ParamsRepository {

    private tableName: string = "EosParams";
    private table: TableService;
    private partitionKey = "Params";
    private rowKey = "";

    private map(entity: any): Params {
        if (!entity) {
            return null;
        } else {
            return {
                nextActionSequence: entity.NextActionSequence._,
                lastProcessedBlockTimestamp: entity.LastProcessedBlockTimestamp && entity.LastProcessedBlockTimestamp._
            }
        }
    }

    constructor(private settings: Settings) {
        this.table = createTableService(settings.EosApi.DataConnectionString);
    }

    get(): Promise<Params> {
        return select(this.table, this.tableName, this.partitionKey, this.rowKey)
            .then(entity => this.map(entity));
    }

    upsert(params: Params): Promise<void> {
        return ensureTable(this.table, this.tableName)
            .then(() => {
                return new Promise<void>((res, rej) => {
                    const entity = {
                        PartitionKey: TableUtilities.entityGenerator.String(this.partitionKey),
                        RowKey: TableUtilities.entityGenerator.String(this.rowKey),
                        NextActionSequence: TableUtilities.entityGenerator.Int64(params.nextActionSequence),
                        LastProcessedBlockTimestamp: TableUtilities.entityGenerator.DateTime(params.lastProcessedBlockTimestamp)
                    };
                    this.table.insertOrMergeEntity(this.tableName, entity, (err, result) => {
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