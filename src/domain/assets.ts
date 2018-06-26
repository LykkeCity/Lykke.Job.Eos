import { TableQuery } from "azure-storage";
import { Settings } from "../common";
import { AzureQueryResult, AzureEntity, AzureRepository, Ignore, Int32 } from "./queries";
import { isString } from "util";

export class AssetEntity extends AzureEntity {

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

    async get(id: string): Promise<AssetEntity>;
    async get(take: number, continuation?: string): Promise<AzureQueryResult<AssetEntity>>;
    async get(idOrTake: string | number, continuation?: string): Promise<AssetEntity | AzureQueryResult<AssetEntity>> {
        if (isString(idOrTake)) {
            return await this.select(AssetEntity, this.tableName, idOrTake, "");
        } else {
            return await this.select(AssetEntity, this.tableName, new TableQuery().top(idOrTake || 100), continuation);
        }
    }

    async all(): Promise<AssetEntity[]> {
        return await this.selectAll(c => this.get(100, c));
    }
}