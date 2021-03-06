import { MongoEntity, MongoRepository, MongoQueryResult } from "./mongo";
import { Settings } from "../common";
import { isString } from "util";


export class BalanceEntity extends MongoEntity<{ Address: string, AssetId: string }> {
    Amount: number;
    AmountInBaseUnit: number;
    Block: number;
}

export class BalanceRepository extends MongoRepository {

    private addressCollectionName: string = "EosBalanceAddresses";
    private balanceCollectionName: string = "EosBalances";

    constructor(settings: Settings) {
        super(
            settings.EosJob.Mongo.ConnectionString,
            settings.EosJob.Mongo.User,
            settings.EosJob.Mongo.Password,
            settings.EosJob.Mongo.Database);
    }

    async observe(address: string) {
        const db = await this.db();
        await db.collection(this.addressCollectionName)
            .replaceOne(
                { _id: address },
                { _id: address },
                { upsert: true }
            );

        await db.collection(this.balanceCollectionName)
            .updateMany(
                { Address: { $eq: address } },
                { $set: { IsObservable: true } }
            );
    }

    async isObservable(address: string): Promise<boolean> {
        const db = await this.db();
        const entity = await db.collection(this.addressCollectionName).findOne({ _id: address });

        return !!entity;
    }

    async remove(address: string) {
        const db = await this.db();
        await db.collection(this.addressCollectionName).deleteOne({ _id: address });
        await db.collection(this.balanceCollectionName)
            .updateMany(
                { Address: { $eq: address } },
                { $set: { IsObservable: false } }
            );
    }

    async upsert(address: string, assetId: string, operationOrTxId: string, actionId: string, amount: number, amountInBaseUnit: number, block: number) {
        const db = await this.db();
        const legacyId = `${address}_${assetId}_${operationOrTxId}`;
        const id = `${address}_${assetId}_${operationOrTxId}_${actionId}`;
        const isObservable = await this.isObservable(address);

        // delete record without action ID, if any
        await db.collection(this.balanceCollectionName).deleteOne({ _id: legacyId });

        // upsert actual record
        await db.collection(this.balanceCollectionName)
            .updateOne(
                { _id: id },
                { $set: { _id: id, Address: address, AssetId: assetId, OperationOrTxId: operationOrTxId, ActionId: actionId, Amount: amount, AmountInBaseUnit: amountInBaseUnit, Block: block, IsObservable: isObservable } },
                { upsert: true }
            );
    }

    async get(address: string, assetId: string): Promise<BalanceEntity>;
    async get(take: number, continuation?: string): Promise<MongoQueryResult<BalanceEntity>>;
    async get(addressOrTake: string | number, assetIdOrcontinuation?: string): Promise<BalanceEntity | MongoQueryResult<BalanceEntity>> {
        const db = await this.db();
        if (isString(addressOrTake)) {
            return await db.collection<BalanceEntity>(this.balanceCollectionName)
                .aggregate([
                    { $match: { Address: addressOrTake, AssetId: assetIdOrcontinuation } },
                    { $group: { _id: { Address: "$Address", AssetId: "$AssetId" }, Amount: { $sum: "$Amount" }, AmountInBaseUnit: { $sum: "$AmountInBaseUnit" }, Block: { $max: "$Block" } } },
                ])
                .next();
        } else {
            const skip = parseInt(assetIdOrcontinuation) || 0;
            const entities = await db.collection<BalanceEntity>(this.balanceCollectionName)
                .aggregate([
                    { $match: { IsObservable: { $eq: true } } },
                    { $group: { _id: { Address: "$Address", AssetId: "$AssetId" }, Amount: { $sum: "$Amount" }, AmountInBaseUnit: { $sum: "$AmountInBaseUnit" }, Block: { $max: "$Block" } } },
                    // { $match: { Amount: { $gt: 0 } } }, // CosmosDB doesn't suppport multiple $match-es in public preview version
                    { $skip: skip },
                    { $limit: addressOrTake }
                ])
                .toArray();

            return new MongoQueryResult(entities, entities.length < addressOrTake ? null : (skip + addressOrTake).toFixed());
        }
    }

    validateContinuation(continuation: string): boolean {
        return !continuation || (!Number.isNaN(parseInt(continuation)) && /^\d+$/.test(continuation));
    }
}