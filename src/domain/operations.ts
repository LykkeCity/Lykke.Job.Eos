import { Asset } from "./assets";
import { isString } from "util";

export class OperationItem {
    constructor(public from: string, public to: string, public asset: Asset, amount: string | number) {
        this.amount = isString(amount)
            ? parseInt(amount) / Math.pow(10, asset.accuracy)
            : amount;
    }

    amount: number;
}