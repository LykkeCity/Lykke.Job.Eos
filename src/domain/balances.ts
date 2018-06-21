import { Asset } from "./assets";
import { Settings } from "../common";
import { AzureEntity, AzureRepository, Ignore, Double } from "./queries";

export class Balance extends AzureEntity {

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
}

export class BalanceRepository extends AzureRepository {

    private tableName: string = "EosBalances";

    constructor(private settings: Settings) {
        super(settings.EosApi.DataConnectionString);
    }

    /**
     * Updates or creates balance record for address.
     * @param address Address
     * @param asset Asset
     * @param affix Amount to add (if positive) or subtract (if negative)
     */
    async upsert(address: string, asset: Asset, affix: number): Promise<number> {
        let entity = await this.select(Balance, this.tableName, address, asset.AssetId);

        if (entity) {
            entity.Amount += affix;
        } else {
            entity = new Balance();
            entity.PartitionKey = address;
            entity.RowKey = asset.AssetId;
            entity.Amount = affix;
        }

        await this.insertOrMerge(this.tableName, entity);

        return entity.Amount;
    }
}