import { createTableService, TableService, TableUtilities } from "azure-storage";
import { Settings } from "../common";
import { select, ensureTable } from "./queries";

export interface Params {
    nextActionSequence: number;
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
            }
        }
    }

    constructor(private settings: Settings) {
        this.table = createTableService(settings.EosApi.DataConnectionString);
    }

    async get(): Promise<Params> {
        return this.map(await select(this.table, this.tableName, this.partitionKey, this.rowKey));
    }

    async update(nextActionSequence: number): Promise<any> {
        return ensureTable(this.table, this.tableName)
            .then(() => {
                return new Promise<any>((res, rej) => {
                    const entity = {
                        PartitionKey: TableUtilities.entityGenerator.String(this.partitionKey),
                        RowKey: TableUtilities.entityGenerator.String(this.rowKey),
                        NextActionSequence: TableUtilities.entityGenerator.Int64(nextActionSequence)
                    };
                    this.table.insertOrReplaceEntity(this.tableName, entity, (err, result) => {
                        if (err) {
                            rej(err);
                        } else {
                            res(result);
                        }
                    });
                });
            });
    }
}