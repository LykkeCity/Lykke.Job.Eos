import { TableQuery } from "azure-storage";
import { Settings } from "../common";
import { AzureQueryResult, AzureEntity, AzureRepository, Ignore, Int32 } from "./queries";
import { isString } from "util";

export class Asset extends AzureEntity {

    @Ignore()
    get AssetId(): string {
        return this.PartitionKey;
    }

    Address: string;
    Name: string;

    @Int32()
    Accuracy: number;
}

export class AssetRepository extends AzureRepository {

    private tableName: string = "EosAssets";

    constructor(private settings: Settings) {
        super(settings.EosJob.DataConnectionString);
    }

    async get(id: string): Promise<Asset>;
    async get(take: number, continuation?: string): Promise<AzureQueryResult<Asset>>;
    async get(idOrTake: string | number, continuation?: string): Promise<Asset | AzureQueryResult<Asset>> {
        if (isString(idOrTake)) {
            return await this.select(Asset, this.tableName, idOrTake, "");
        } else {
            return await this.select(Asset, this.tableName, new TableQuery().top(idOrTake || 100), continuation);
        }
    }

    async all(): Promise<Asset[]> {
        return await this.selectAll(c => this.get(100, c));
    }
}