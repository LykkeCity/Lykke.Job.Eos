import { Settings } from "../common";
import { AzureEntity, AzureRepository, Ignore, Double, AzureQueryResult, Int64 } from "./queries";
import { isString } from "util";
import { TableQuery } from "azure-storage";

export class BalanceEntity extends AzureEntity {

    @Ignore()
    get Address(): string {
        return this.PartitionKey;
    }

    @Ignore()
    get AssetId(): string {
        return this.RowKey;
    }

    @Double()
    Amount: number;

    @Int64()
    AmountInBaseUnit: number;
}

export class BalanceRepository extends AzureRepository {

    private tableName: string = "EosBalances";

    constructor(private settings: Settings) {
        super(settings.EosJob.DataConnectionString);
    }

    /**
     * Updates or creates balance record for address.
     * @param address Address
     * @param assetId Asset
     * @param affix Amount to add (if positive) or subtract (if negative)
     */
    async upsert(address: string, assetId: string, affix: number, affixInBaseUnit: number): Promise<BalanceEntity> {
        let entity = await this.select(BalanceEntity, this.tableName, address, assetId);

        if (entity) {
            entity.Amount += affix;
            entity.AmountInBaseUnit += affixInBaseUnit;
        } else {
            entity = new BalanceEntity();
            entity.PartitionKey = address;
            entity.RowKey = assetId;
            entity.Amount = affix;
            entity.AmountInBaseUnit = affixInBaseUnit;
        }

        await this.insertOrMerge(this.tableName, entity);

        return entity;
    }

    async get(id: string): Promise<BalanceEntity>;
    async get(take: number, continuation?: string): Promise<AzureQueryResult<BalanceEntity>>;
    async get(idOrTake: string | number, continuation?: string): Promise<BalanceEntity | AzureQueryResult<BalanceEntity>> {
        if (isString(idOrTake)) {
            return await this.select(BalanceEntity, this.tableName, idOrTake, "");
        } else {
            return await this.select(BalanceEntity, this.tableName, new TableQuery().top(idOrTake || 100), continuation);
        }
    }

    async all(): Promise<BalanceEntity[]> {
        return await this.selectAll(c => this.get(100, c));
    }
}