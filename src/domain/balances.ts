import { AssetEntity } from "./assets";
import { Settings } from "../common";
import { AzureEntity, AzureRepository, Ignore, Double } from "./queries";

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
    Balance: number;
}

export class BalanceRepository extends AzureRepository {

    private tableName: string = "EosBalances";

    constructor(private settings: Settings) {
        super(settings.EosJob.DataConnectionString);
    }

    /**
     * Updates or creates balance record for address.
     * @param address Address
     * @param asset Asset
     * @param affix Amount to add (if positive) or subtract (if negative)
     */
    async upsert(address: string, asset: AssetEntity, affix: number): Promise<number> {
        let entity = await this.select(BalanceEntity, this.tableName, address, asset.AssetId);

        if (entity) {
            entity.Balance += affix;
        } else {
            entity = new BalanceEntity();
            entity.PartitionKey = address;
            entity.RowKey = asset.AssetId;
            entity.Balance = affix;
        }

        await this.insertOrMerge(this.tableName, entity);

        return entity.Balance;
    }
}