"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongo_1 = require("./mongo");
const util_1 = require("util");
class BalanceEntity extends mongo_1.MongoEntity {
}
exports.BalanceEntity = BalanceEntity;
class BalanceRepository extends mongo_1.MongoRepository {
    constructor(settings) {
        super(settings.EosJob.Mongo.ConnectionString, settings.EosJob.Mongo.User, settings.EosJob.Mongo.Password, settings.EosJob.Mongo.Database);
        this.addressCollectionName = "EosBalanceAddresses";
        this.balanceCollectionName = "EosBalances";
    }
    async observe(address) {
        const db = await this.db();
        await db.collection(this.addressCollectionName)
            .replaceOne({ _id: address }, { _id: address }, { upsert: true });
        await db.collection(this.balanceCollectionName)
            .updateMany({ Address: { $eq: address } }, { $set: { IsObservable: true } });
    }
    async isObservable(address) {
        const db = await this.db();
        const entity = await db.collection(this.addressCollectionName).findOne({ _id: address });
        return !!entity;
    }
    async remove(address) {
        const db = await this.db();
        await db.collection(this.addressCollectionName).deleteOne({ _id: address });
        await db.collection(this.balanceCollectionName)
            .updateMany({ Address: { $eq: address } }, { $set: { IsObservable: false } });
    }
    async upsert(address, assetId, operationOrTxId, amount, amountInBaseUnit) {
        const db = await this.db();
        const id = `${address}_${assetId}_${operationOrTxId}`;
        const isObservable = await this.isObservable(address);
        await db.collection(this.balanceCollectionName)
            .updateOne({ _id: id }, { $set: { _id: id, Address: address, AssetId: assetId, OperationOrTxId: operationOrTxId, Amount: amount, AmountInBaseUnit: amountInBaseUnit, IsObservable: isObservable } }, { upsert: true });
    }
    async update(address, assetId, operationOrTxId, params) {
        const db = await this.db();
        const id = `${address}_${assetId}_${operationOrTxId}`;
        await db.collection(this.balanceCollectionName)
            .updateOne({ _id: id }, { $set: { IsCancelled: params.isCancelled } }, { upsert: true });
    }
    async get(addressOrTake, assetIdOrcontinuation) {
        const db = await this.db();
        if (util_1.isString(addressOrTake)) {
            return await db.collection(this.balanceCollectionName)
                .aggregate([
                { $match: { Address: addressOrTake, AssetId: assetIdOrcontinuation, IsCancelled: { $ne: true } } },
                { $group: { _id: { Address: "$Address", AssetId: "$Assetid" }, Amount: { $sum: "$Amount" }, AmountInBaseUnit: { $sum: "$AmountInBaseUnit" } } },
            ])
                .next();
        }
        else {
            const skip = parseInt(assetIdOrcontinuation) || 0;
            const entities = await db.collection(this.balanceCollectionName)
                .aggregate([
                { $match: { IsCancelled: { $ne: true }, IsObservable: { $eq: true } } },
                { $group: { _id: { Address: "$Address", AssetId: "$Assetid" }, Amount: { $sum: "$Amount" }, AmountInBaseUnit: { $sum: "$AmountInBaseUnit" } } },
                { $skip: skip },
                { $limit: addressOrTake }
            ])
                .toArray();
            return new mongo_1.MongoQueryResult(entities, entities.length < addressOrTake ? null : (skip + addressOrTake).toFixed());
        }
    }
}
exports.BalanceRepository = BalanceRepository;
//# sourceMappingURL=balances.js.map