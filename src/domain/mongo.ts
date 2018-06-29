import { MongoClient, ObjectID, Db } from "mongodb";

export abstract class MongoEntity<ID> {
    _id: ID;
}

export abstract class MongoRepository {

    private _db: Db;

    constructor(private connectionString: string, private database: string) {
    }

    protected async db(): Promise<Db> {
        if (this._db == null) {
            this._db = (await MongoClient.connect(this.connectionString)).db(this.database);
        }

        return this._db;
    }
}

export class MongoQueryResult<T> {
    constructor(public items: T[], continuation: string) {
    }
}