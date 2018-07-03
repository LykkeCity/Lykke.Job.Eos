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
const azure_1 = require("./azure");
const azure_storage_1 = require("azure-storage");
class HistoryEntity extends azure_1.AzureEntity {
}
__decorate([
    azure_1.Double(),
    __metadata("design:type", Number)
], HistoryEntity.prototype, "Amount", void 0);
__decorate([
    azure_1.Int64(),
    __metadata("design:type", Number)
], HistoryEntity.prototype, "AmountInBaseUnit", void 0);
exports.HistoryEntity = HistoryEntity;
class HistoryByTxIdEntity extends azure_1.AzureEntity {
    get TxId() {
        return this.PartitionKey;
    }
}
__decorate([
    azure_1.Ignore(),
    __metadata("design:type", String),
    __metadata("design:paramtypes", [])
], HistoryByTxIdEntity.prototype, "TxId", null);
__decorate([
    azure_1.Int64(),
    __metadata("design:type", Number)
], HistoryByTxIdEntity.prototype, "Block", void 0);
exports.HistoryByTxIdEntity = HistoryByTxIdEntity;
var HistoryAddressCategory;
(function (HistoryAddressCategory) {
    HistoryAddressCategory["From"] = "From";
    HistoryAddressCategory["To"] = "To";
})(HistoryAddressCategory = exports.HistoryAddressCategory || (exports.HistoryAddressCategory = {}));
class HistoryRepository extends azure_1.AzureRepository {
    constructor(settings) {
        super(settings.EosJob.Azure.ConnectionString);
        this.settings = settings;
        this.historyTableName = "EosHistory";
        this.historyByTxIdTableName = "EosHistoryByTxId";
    }
    async upsert(from, to, assetId, amount, amountInBaseUnit, block, blockTime, txId, actionId, operationId) {
        const historyByTxIdEntity = new HistoryByTxIdEntity();
        historyByTxIdEntity.PartitionKey = txId;
        historyByTxIdEntity.RowKey = "";
        historyByTxIdEntity.Block = block;
        await this.insertOrMerge(this.historyByTxIdTableName, historyByTxIdEntity);
        const historyEntity = new HistoryEntity();
        historyEntity.PartitionKey = `${HistoryAddressCategory.From}_${from}`;
        historyEntity.RowKey = `${block}_${txId}_${actionId}`;
        historyEntity.From = from;
        historyEntity.To = to;
        historyEntity.Amount = amount;
        historyEntity.AmountInBaseUnit = amountInBaseUnit;
        historyEntity.AssetId = assetId;
        historyEntity.Block = block;
        historyEntity.BlockTime = blockTime;
        historyEntity.TxId = txId;
        historyEntity.ActionId = actionId;
        historyEntity.OperationId = operationId;
        await this.insertOrMerge(this.historyTableName, historyEntity);
        historyEntity.PartitionKey = `${HistoryAddressCategory.To}_${to}`;
        await this.insertOrMerge(this.historyTableName, historyEntity);
    }
    async get(category, address, take = 100, afterHash = null) {
        let query = new azure_storage_1.TableQuery()
            .where("PartitionKey == ?", `${category}_${address}`)
            .top(take);
        if (!!afterHash) {
            const index = await this.select(HistoryByTxIdEntity, this.historyByTxIdTableName, afterHash, "");
            if (!!index) {
                query = query.and("RowKey > ?", index.Block);
            }
        }
        return await this.selectAll(async (c) => await this.select(HistoryEntity, this.historyTableName, query, c));
    }
}
exports.HistoryRepository = HistoryRepository;
//# sourceMappingURL=history.js.map