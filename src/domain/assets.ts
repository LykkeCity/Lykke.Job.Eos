import { createTableService, TableService, TableQuery, TableUtilities } from "azure-storage";
import { Settings } from "../common";
import { QueryResult, select, toAzure, all, AzureEntity } from "./queries";
import { isString } from "util";

export class Asset extends AzureEntity {
    AssetId: string;
    Address: string;
    Name: string;
    Accuracy: number;
}

export class AssetRepository {

    private tableName: string = "EosAssets";
    private table: TableService;

    constructor(private settings: Settings) {
        this.table = createTableService(settings.EosApi.DataConnectionString);
    }

    async get(id: string): Promise<Asset>;
    async get(take: number, continuation?: string): Promise<QueryResult<Asset>>;
    async get(idOrTake: string | number, continuation?: string): Promise<Asset | QueryResult<Asset>> {
        if (isString(idOrTake)) {
            return await select(Asset, this.table, this.tableName, idOrTake, "");
        } else {
            return await select(Asset, this.table, this.tableName, new TableQuery().top(idOrTake || 100), toAzure(continuation));
        }
    }

    async all(): Promise<Asset[]> {
        return await all(c => this.get(100, c));
    }
}