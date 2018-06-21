"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
const queries_1 = require("./queries");
class Balance extends queries_1.AzureEntity {
    get Address() {
        return this.PartitionKey;
    }
    get AssetId() {
        return this.RowKey;
    }
}
__decorate([
    queries_1.Ignore(),
    __metadata("design:type", String),
    __metadata("design:paramtypes", [])
], Balance.prototype, "Address", null);
__decorate([
    queries_1.Ignore(),
    __metadata("design:type", String),
    __metadata("design:paramtypes", [])
], Balance.prototype, "AssetId", null);
__decorate([
    queries_1.Double(),
    __metadata("design:type", Number)
], Balance.prototype, "Amount", void 0);
exports.Balance = Balance;
class BalanceRepository extends queries_1.AzureRepository {
    constructor(settings) {
        super(settings.EosApi.DataConnectionString);
        this.settings = settings;
        this.tableName = "EosBalances";
    }
    /**
     * Updates or creates balance record for address.
     * @param address Address
     * @param asset Asset
     * @param affix Amount to add (if positive) or subtract (if negative)
     */
    async upsert(address, asset, affix) {
        let entity = await this.select(Balance, this.tableName, address, asset.AssetId);
        if (entity) {
            entity.Amount += affix;
        }
        else {
            entity = new Balance();
            entity.PartitionKey = address;
            entity.RowKey = asset.AssetId;
            entity.Amount = affix;
        }
        await this.insertOrMerge(this.tableName, entity);
        return entity.Amount;
    }
}
exports.BalanceRepository = BalanceRepository;
//# sourceMappingURL=balances.js.map