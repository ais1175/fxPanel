import { DbInstance, SavePriority } from '../instance';
import consoleFactory from '@lib/console';
import { DatabaseWhitelistApprovalsType, DatabaseWhitelistRequestsType } from '../databaseTypes';
import { DatabaseWhitelistApprovalSchema, DatabaseWhitelistRequestSchema } from '../databaseSchemas';
import { DuplicateKeyError, genWhitelistRequestID } from '../dbUtils';
const console = consoleFactory('DatabaseDao');

const WhitelistRequestWithoutIdSchema = DatabaseWhitelistRequestSchema.omit({ id: true });

/**
 * Data access object for the database whitelist collections.
 */
export default class WhitelistDao {
    constructor(private readonly db: DbInstance) {}

    private get dbo() {
        if (!this.db.obj || !this.db.isReady) throw new Error(`database not ready yet`);
        return this.db.obj;
    }

    private get chain() {
        if (!this.db.obj || !this.db.isReady) throw new Error(`database not ready yet`);
        return this.db.obj.chain;
    }

    /**
     * Returns all whitelist approvals, which can be optionally filtered
     */
    findManyApprovals(
        filter?: Partial<DatabaseWhitelistApprovalsType> | ((item: DatabaseWhitelistApprovalsType) => boolean),
    ): DatabaseWhitelistApprovalsType[] {
        return this.chain
            .get('whitelistApprovals')
            .filter(filter as any)
            .cloneDeep()
            .value();
    }

    /**
     * Removes whitelist approvals based on a filter.
     */
    removeManyApprovals(
        filter: Partial<DatabaseWhitelistApprovalsType> | ((item: DatabaseWhitelistApprovalsType) => boolean),
    ): DatabaseWhitelistApprovalsType[] {
        this.db.writeFlag(SavePriority.MEDIUM);
        return this.chain
            .get('whitelistApprovals')
            .remove(filter as any)
            .value();
    }

    /**
     * Register a whitelist request to the database
     */
    registerApproval(approval: DatabaseWhitelistApprovalsType): void {
        DatabaseWhitelistApprovalSchema.parse(approval);

        //Check for duplicated license
        const found = this.chain.get('whitelistApprovals').filter({ identifier: approval.identifier }).value();
        if (found.length) throw new DuplicateKeyError(`this identifier is already whitelisted`);

        //Register new
        this.db.writeFlag(SavePriority.LOW);
        this.chain.get('whitelistApprovals').push(structuredClone(approval)).value();
    }

    /**
     * Returns all whitelist approvals, which can be optionally filtered
     */
    findManyRequests(
        filter?: Partial<DatabaseWhitelistRequestsType> | ((item: DatabaseWhitelistRequestsType) => boolean),
    ): DatabaseWhitelistRequestsType[] {
        return this.chain
            .get('whitelistRequests')
            .filter(filter as any)
            .cloneDeep()
            .value();
    }

    /**
     * Removes whitelist requests based on a filter.
     */
    removeManyRequests(
        filter: Partial<DatabaseWhitelistRequestsType> | ((item: DatabaseWhitelistRequestsType) => boolean),
    ): DatabaseWhitelistRequestsType[] {
        this.db.writeFlag(SavePriority.LOW);
        return this.chain
            .get('whitelistRequests')
            .remove(filter as any)
            .value();
    }

    /**
     * Updates a whitelist request setting assigning srcData props to the database object.
     * The source data object is deep cloned to prevent weird side effects.
     */
    updateRequest(
        license: string,
        srcData: Partial<Omit<DatabaseWhitelistRequestsType, 'id' | 'license'>>,
    ): DatabaseWhitelistRequestsType {
        if ('id' in srcData || 'license' in srcData) {
            throw new Error(`cannot update id or license fields`);
        }

        const requestDbObj = this.chain.get('whitelistRequests').find({ license });
        if (!requestDbObj.value()) throw new Error('Request not found in database');
        this.db.writeFlag(SavePriority.LOW);
        return requestDbObj.assign(structuredClone(srcData)).cloneDeep().value();
    }

    /**
     * Register a whitelist request to the database
     */
    registerRequest(request: Omit<DatabaseWhitelistRequestsType, 'id'>): string {
        WhitelistRequestWithoutIdSchema.parse(request);
        if ('id' in request) {
            throw new Error(`cannot manually set the id field`);
        }

        const id = genWhitelistRequestID(this.dbo);
        this.db.writeFlag(SavePriority.LOW);
        this.chain
            .get('whitelistRequests')
            .push({ id, ...structuredClone(request) })
            .value();
        return id;
    }
}
