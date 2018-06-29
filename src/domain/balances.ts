import { Settings } from "../common";
import { AzureEntity, AzureRepository, Ignore, Double, AzureQueryResult, Int64 } from "./azure";
import { isString } from "util";
import { TableQuery } from "azure-storage";
import { MongoClient, ObjectID, ObjectId } from "mongodb";
import { MongoRepository, MongoEntity, MongoQueryResult } from "./mongo";

export class AddressEntity extends AzureEntity {
    @Ignore()
    get Address(): string {
        return this.PartitionKey;
    }
}

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

    private addressTableName: string = "EosBalanceAddresses";
    private balanceTableName: string = "EosBalances";

    constructor(private settings: Settings) {
        super(settings.EosJob.AzureConnectionString);
    }

    async observe(address: string) {
        const entity = new AddressEntity();
        entity.PartitionKey = address;
        entity.RowKey = "";

        await this.insertOrMerge(this.addressTableName, entity);
    }

    async isObservable(address: string): Promise<boolean> {
        return !!(await this.select(AddressEntity, this.addressTableName, address, ""));
    }

    /**
     * Creates, updates or removes balance record for address.
     * @param address Address
     * @param assetId Asset
     * @param affix Amount to add (if positive) or subtract (if negative)
     */
    async modify(address: string, assetId: string, affix: number, affixInBaseUnit: number): Promise<{ amount: number, amountInBaseUnit: number }> {
        let entity = await this.select(BalanceEntity, this.balanceTableName, address, assetId);
        if (entity == null) {
            entity = new BalanceEntity();
            entity.PartitionKey = address;
            entity.RowKey = assetId;
        }

        entity.Amount += affix;
        entity.AmountInBaseUnit += affixInBaseUnit;

        if (entity.AmountInBaseUnit != 0) {
            await this.insertOrMerge(this.balanceTableName, entity);
        } else {
            await this.delete(this.balanceTableName, entity.PartitionKey, entity.RowKey);
        }

        return {
            amount: entity.Amount,
            amountInBaseUnit: entity.AmountInBaseUnit
        };
    }

    async remove(address: string, assetId?: string) {
        if (!!assetId) {
            await this.delete(this.balanceTableName, address, assetId);
        } else {
            await this.delete(this.addressTableName, address, "");
            await this.deleteAll(BalanceEntity, this.balanceTableName, new TableQuery().where("PartitionKey == ?", address));
        }
    }

    async get(address: string, assetId: string): Promise<BalanceEntity>;
    async get(take: number, continuation?: string): Promise<AzureQueryResult<BalanceEntity>>;
    async get(addressOrTake: string | number, assetIdOrcontinuation?: string): Promise<BalanceEntity | AzureQueryResult<BalanceEntity>> {
        if (isString(addressOrTake)) {
            return await this.select(BalanceEntity, this.balanceTableName, addressOrTake, assetIdOrcontinuation);
        } else {
            return await this.select(BalanceEntity, this.balanceTableName, new TableQuery().top(addressOrTake || 100), assetIdOrcontinuation);
        }
    }
}

export class BalanceMongoEntity extends MongoEntity<{ Address: string, AssetId: string }> {
    Amount: number;
    AmountInBaseUnit: number;
}

export class BalanceMongoRepository extends MongoRepository {

    private collectionName: string = "EosBalances";

    constructor(settings: Settings) {
        super(settings.EosJob.MongoConnectionString, settings.EosJob.MongoDatabase);
    }

    async record(address: string, assetId: string, operationOrTxId: string, amount: number, amountInBaseUnit: number) {
        const db = await this.db();
        await db.collection(this.collectionName)
            .replaceOne(
                { _id: `${address}_${assetId}_${operationOrTxId}` },
                { _id: `${address}_${assetId}_${operationOrTxId}`, Address: address, AssetId: assetId, OperationOrTxId: operationOrTxId, Amount: amount, AmountInBaseUnit: amountInBaseUnit },
                { upsert: true }
            );
    }

    async get(address: string, assetId: string): Promise<BalanceMongoEntity>;
    async get(take: number, continuation?: string): Promise<MongoQueryResult<BalanceMongoEntity>>;
    async get(addressOrTake: string | number, assetIdOrcontinuation?: string): Promise<BalanceMongoEntity | MongoQueryResult<BalanceMongoEntity>> {
        const db = await this.db();
        if (isString(addressOrTake)) {
            return await db.collection<BalanceMongoEntity>(this.collectionName)
                .aggregate([
                    { $match: { Address: addressOrTake, AssetId: assetIdOrcontinuation } },
                    { $group: { _id: { Address: "$Address", AssetId: "$Assetid" }, Amount: { $sum: "$Amount" }, AmountInBaseUnit: { $sum: "$AmountInBaseUnit" } } }
                ])
                .next();
        } else {
            const skip = parseInt(assetIdOrcontinuation) || 0;
            const entities = await db.collection<BalanceMongoEntity>(this.collectionName)
                .aggregate([
                    { $group: { _id: { Address: "$Address", AssetId: "$Assetid" }, Amount: { $sum: "$Amount" }, AmountInBaseUnit: { $sum: "$AmountInBaseUnit" } } },
                    { $skip: skip },
                    { $limit: addressOrTake }
                ])
                .toArray();

            return new MongoQueryResult(entities, entities.length < addressOrTake ? null : (skip + addressOrTake).toFixed());
        }
    }
}