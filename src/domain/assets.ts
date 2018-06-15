import { createTableService, TableService, TableQuery, TableUtilities } from "azure-storage";
import { Settings } from "../common";
import { QueryResult, select, toAzure } from "./queries";
import { isString } from "util";

export interface Asset {
    assetId: string;
    address: string;
    name: string;
    accuracy: number;
}

export class AssetRepository {

    private tableName: string = "EosAssets";
    private table: TableService;

    private map(entity: any): Asset {
        if (!entity) {
            return null;
        } else {
            return {
                assetId: entity.PartitionKey._,
                address: entity.Address._,
                name: entity.Name._,
                accuracy: entity.Accuracy._
            }
        }
    }

    constructor(private settings: Settings) {
        this.table = createTableService(settings.EosApi.DataConnectionString);
    }

    async get(id: string): Promise<Asset>;
    async get(take: number, continuation?: string): Promise<Asset[]>;
    async get(idOrTake: string | number, continuation?: string): Promise<Asset | Asset[]> {
        if (isString(idOrTake)) {
            return this.map(await select(this.table, this.tableName, idOrTake, ""));
        } else {
            return new QueryResult(await select(this.table, this.tableName, new TableQuery().top(idOrTake || 100), toAzure(continuation)), this.map).items;
        }
    }
}