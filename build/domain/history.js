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
class HistoryEntity extends queries_1.AzureEntity {
}
__decorate([
    queries_1.Double(),
    __metadata("design:type", Number)
], HistoryEntity.prototype, "Amount", void 0);
exports.HistoryEntity = HistoryEntity;
class HistoryByTxIdEntity extends queries_1.AzureEntity {
    get TxId() {
        return this.PartitionKey;
    }
}
__decorate([
    queries_1.Ignore(),
    __metadata("design:type", String),
    __metadata("design:paramtypes", [])
], HistoryByTxIdEntity.prototype, "TxId", null);
__decorate([
    queries_1.Int64(),
    __metadata("design:type", Number)
], HistoryByTxIdEntity.prototype, "BlockNum", void 0);
exports.HistoryByTxIdEntity = HistoryByTxIdEntity;
class HistoryRepository extends queries_1.AzureRepository {
    constructor(settings) {
        super(settings.EosJob.DataConnectionString);
        this.settings = settings;
        this.historyTableName = "EosHistory";
        this.historyByTxIdTableName = "EosHistoryByTxId";
    }
    async upsert(from, to, amount, asset, blockNum, txId, actionId, operationId) {
        const historyByTxIdEntity = new HistoryByTxIdEntity();
        historyByTxIdEntity.PartitionKey = txId;
        historyByTxIdEntity.RowKey = "";
        historyByTxIdEntity.BlockNum = blockNum;
        await this.insertOrMerge(this.historyByTxIdTableName, historyByTxIdEntity);
        const historyEntity = new HistoryEntity();
        historyEntity.PartitionKey = `From_${from}`;
        historyEntity.RowKey = `${blockNum}_${txId}_${actionId}`;
        historyEntity.From = from;
        historyEntity.To = to;
        historyEntity.Amount = amount;
        historyEntity.AssetId = asset.AssetId;
        historyEntity.TxId = txId;
        historyEntity.OperationId = operationId;
        await this.insertOrMerge(this.historyTableName, historyEntity);
        historyEntity.PartitionKey = `To_${to}`;
        await this.insertOrMerge(this.historyTableName, historyEntity);
    }
}
exports.HistoryRepository = HistoryRepository;
//# sourceMappingURL=history.js.map