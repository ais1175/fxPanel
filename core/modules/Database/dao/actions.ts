import { DbInstance, SavePriority } from '../instance';
import {
    DatabaseActionBanType,
    DatabaseActionKickType,
    DatabaseActionType,
    DatabaseActionWarnType,
} from '../databaseTypes';
import { genActionID } from '../dbUtils';
import { now } from '@lib/misc';
import consoleFactory from '@lib/console';
const console = consoleFactory('DatabaseDao');

/**
 * Index structure for fast action lookups
 * Maps identifiers and HWIDs to sets of action IDs
 */
interface ActionsIndex {
    ids: Map<string, Set<string>>; // id -> Set<actionId>
    hwids: Map<string, Set<string>>; // hwid -> Set<actionId>
}

/**
 * Data access object for the database "actions" collection.
 * Includes indexing for O(1) lookups by identifiers and HWIDs.
 */
export default class ActionsDao {
    private index: ActionsIndex = {
        ids: new Map(),
        hwids: new Map(),
    };

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
     * Builds the indexes from the database
     * Should be called once when the database is ready
     */
    buildIndexes(): void {
        console.verbose.log('Building actions indexes...');
        const startTime = Date.now();

        // Clear existing indexes
        this.index.ids.clear();
        this.index.hwids.clear();

        // Build indexes from all actions
        const actions = this.chain.get('actions').value();
        for (const action of actions) {
            this.addToIndex(action);
        }

        console.verbose.log(`Actions indexes built in ${Date.now() - startTime}ms`);
        console.verbose.log(`  - IDs indexed: ${this.index.ids.size}`);
        console.verbose.log(`  - HWIDs indexed: ${this.index.hwids.size}`);
    }

    /**
     * Adds an action to the indexes
     */
    private addToIndex(action: DatabaseActionType): void {
        // Index by IDs
        for (const id of action.ids) {
            if (!this.index.ids.has(id)) {
                this.index.ids.set(id, new Set());
            }
            this.index.ids.get(id)!.add(action.id);
        }

        // Index by HWIDs (only for bans)
        if ('hwids' in action && action.hwids && Array.isArray(action.hwids)) {
            for (const hwid of action.hwids) {
                if (!this.index.hwids.has(hwid)) {
                    this.index.hwids.set(hwid, new Set());
                }
                this.index.hwids.get(hwid)!.add(action.id);
            }
        }
    }

    /**
     * Removes an action from the indexes
     */
    private removeFromIndex(action: DatabaseActionType): void {
        // Remove from ID index
        for (const id of action.ids) {
            const actionIds = this.index.ids.get(id);
            if (actionIds) {
                actionIds.delete(action.id);
                if (actionIds.size === 0) {
                    this.index.ids.delete(id);
                }
            }
        }

        // Remove from HWID index
        if ('hwids' in action && action.hwids && Array.isArray(action.hwids)) {
            for (const hwid of action.hwids) {
                const actionIds = this.index.hwids.get(hwid);
                if (actionIds) {
                    actionIds.delete(action.id);
                    if (actionIds.size === 0) {
                        this.index.hwids.delete(hwid);
                    }
                }
            }
        }
    }

    /**
     * Searches for an action in the database by the id, returns action or null if not found
     */
    findOne(actionId: string): DatabaseActionType | null {
        if (typeof actionId !== 'string' || !actionId.length) throw new Error('Invalid actionId.');

        //Performing search
        const a = this.chain.get('actions').find({ id: actionId }).cloneDeep().value();
        return typeof a === 'undefined' ? null : a;
    }

    /**
     * Searches for any registered action in the database by a list of identifiers and optional filters
     * Usage example: findMany(['license:xxx'], undefined, {type: 'ban'})
     *
     * PERFORMANCE: Uses indexes for O(m) lookups where m is number of matching actions,
     * instead of O(n) full array scan.
     */
    findMany<T extends DatabaseActionType>(
        idsArray: string[],
        hwidsArray?: string[],
        customFilter: ((action: DatabaseActionType) => action is T) | Partial<DatabaseActionType> = {},
    ): T[] {
        if (!Array.isArray(idsArray)) throw new Error('idsArray should be an array');
        if (hwidsArray && !Array.isArray(hwidsArray)) throw new Error('hwidsArray should be an array or undefined');

        try {
            // Collect action IDs from index lookups
            const matchingActionIds = new Set<string>();

            // Lookup by IDs (O(m) where m is number of matching actions)
            for (const id of idsArray) {
                const actionIds = this.index.ids.get(id);
                if (actionIds) {
                    for (const actionId of actionIds) {
                        matchingActionIds.add(actionId);
                    }
                }
            }

            // Lookup by HWIDs if provided
            if (hwidsArray && hwidsArray.length && txConfig.banlist.requiredHwidMatches) {
                const hwidMatches = new Map<string, number>(); // actionId -> match count

                for (const hwid of hwidsArray) {
                    const actionIds = this.index.hwids.get(hwid);
                    if (actionIds) {
                        for (const actionId of actionIds) {
                            const currentCount = hwidMatches.get(actionId) ?? 0;
                            hwidMatches.set(actionId, currentCount + 1);
                        }
                    }
                }

                // Add actions that meet the required HWID match threshold
                for (const [actionId, matchCount] of hwidMatches) {
                    if (matchCount >= txConfig.banlist.requiredHwidMatches) {
                        matchingActionIds.add(actionId);
                    }
                }
            }

            // If no matches found via indexes, return empty array early
            if (matchingActionIds.size === 0) {
                return [];
            }

            // Fetch actions by ID and apply custom filter
            const results: T[] = [];
            for (const actionId of matchingActionIds) {
                const action = this.chain.get('actions').find({ id: actionId }).cloneDeep().value();
                if (!action) continue;

                // Apply custom filter
                if (typeof customFilter === 'function') {
                    if (customFilter(action)) {
                        results.push(action);
                    }
                } else if (Object.keys(customFilter).length > 0) {
                    // Object filter - check if action matches all properties
                    let matches = true;
                    for (const [key, value] of Object.entries(customFilter)) {
                        if (action[key as keyof DatabaseActionType] !== value) {
                            matches = false;
                            break;
                        }
                    }
                    if (matches) {
                        results.push(action as T);
                    }
                } else {
                    // No filter, include all
                    results.push(action as T);
                }
            }

            return results;
        } catch (error) {
            const msg = `Failed to search for a registered action database with error: ${emsg(error)}`;
            console.verbose.error(msg);
            throw new Error(msg);
        }
    }

    /**
     * Registers a ban action and returns its id
     */
    registerBan(
        ids: string[],
        author: string,
        reason: string,
        expiration: number | false,
        playerName: string | false = false,
        hwids?: string[], //only used for bans
    ): string {
        //Sanity check
        if (!Array.isArray(ids) || !ids.length) throw new Error('Invalid ids array.');
        if (typeof author !== 'string' || !author.length) throw new Error('Invalid author.');
        if (typeof reason !== 'string' || !reason.length) throw new Error('Invalid reason.');
        if (expiration !== false && typeof expiration !== 'number') throw new Error('Invalid expiration.');
        if (playerName !== false && (typeof playerName !== 'string' || !playerName.length))
            throw new Error('Invalid playerName.');
        if (hwids && !Array.isArray(hwids)) throw new Error('Invalid hwids array.');

        //Saves it to the database
        const timestamp = now();
        try {
            const actionID = genActionID(this.dbo, 'ban');
            const toDB: DatabaseActionBanType = {
                id: actionID,
                type: 'ban',
                ids,
                hwids,
                playerName,
                reason,
                author,
                timestamp,
                expiration,
            };
            this.chain.get('actions').push(toDB).value();
            this.addToIndex(toDB); // Add to indexes
            this.db.writeFlag(SavePriority.HIGH);
            return actionID;
        } catch (error) {
            let msg = `Failed to register ban to database with message: ${emsg(error)}`;
            console.error(msg);
            console.verbose.dir(error);
            throw error;
        }
    }

    /**
     * Registers a warn action and returns its id
     */
    registerWarn(ids: string[], author: string, reason: string, playerName: string | false = false): string {
        //Sanity check
        if (!Array.isArray(ids) || !ids.length) throw new Error('Invalid ids array.');
        if (typeof author !== 'string' || !author.length) throw new Error('Invalid author.');
        if (typeof reason !== 'string' || !reason.length) throw new Error('Invalid reason.');
        if (playerName !== false && (typeof playerName !== 'string' || !playerName.length))
            throw new Error('Invalid playerName.');

        //Saves it to the database
        const timestamp = now();
        try {
            const actionID = genActionID(this.dbo, 'warn');
            const toDB: DatabaseActionWarnType = {
                id: actionID,
                type: 'warn',
                ids,
                playerName,
                reason,
                author,
                timestamp,
                acked: false,
            };
            this.chain.get('actions').push(toDB).value();
            this.addToIndex(toDB); // Add to indexes
            this.db.writeFlag(SavePriority.HIGH);
            return actionID;
        } catch (error) {
            let msg = `Failed to register warn to database with message: ${emsg(error)}`;
            console.error(msg);
            console.verbose.dir(error);
            throw error;
        }
    }

    /**
     * Registers a kick action and returns its id
     */
    registerKick(ids: string[], author: string, reason: string, playerName: string | false = false): string {
        if (!Array.isArray(ids) || !ids.length) throw new Error('Invalid ids array.');
        if (typeof author !== 'string' || !author.length) throw new Error('Invalid author.');
        if (typeof reason !== 'string' || !reason.length) throw new Error('Invalid reason.');
        if (playerName !== false && (typeof playerName !== 'string' || !playerName.length))
            throw new Error('Invalid playerName.');

        const timestamp = now();
        try {
            const actionID = genActionID(this.dbo, 'kick');
            const toDB: DatabaseActionKickType = {
                id: actionID,
                type: 'kick',
                ids,
                playerName,
                reason,
                author,
                timestamp,
            };
            this.chain.get('actions').push(toDB).value();
            this.addToIndex(toDB); // Add to indexes
            this.db.writeFlag(SavePriority.MEDIUM);
            return actionID;
        } catch (error) {
            let msg = `Failed to register kick to database with message: ${emsg(error)}`;
            console.error(msg);
            console.verbose.dir(error);
            throw error;
        }
    }

    /**
     * Marks a warning as acknowledged
     */
    ackWarn(actionId: string) {
        if (typeof actionId !== 'string' || !actionId.length) throw new Error('Invalid actionId.');

        try {
            const action = this.chain.get('actions').find({ id: actionId }).value();
            if (!action) throw new Error(`action not found`);
            if (action.type !== 'warn') throw new Error(`action is not a warn`);
            action.acked = true;
            this.db.writeFlag(SavePriority.MEDIUM);
        } catch (error) {
            const msg = `Failed to ack warn with message: ${emsg(error)}`;
            console.error(msg);
            console.verbose.dir(error);
            throw error;
        }
    }

    /**
     * Changes the expiration of a ban action
     */
    changeBanExpiration(actionId: string, newExpiration: number | false) {
        if (typeof actionId !== 'string' || !actionId.length) throw new Error('Invalid actionId.');
        if (newExpiration !== false && (typeof newExpiration !== 'number' || newExpiration < 1)) {
            throw new Error('Invalid expiration.');
        }

        try {
            const action = this.chain.get('actions').find({ id: actionId }).value();
            if (!action) throw new Error('action not found');
            if (action.type !== 'ban') throw new Error('action is not a ban');
            if (action.revocation) throw new Error('action is already revoked');
            action.expiration = newExpiration;
            this.db.writeFlag(SavePriority.HIGH);
            return structuredClone(action) as DatabaseActionBanType;
        } catch (error) {
            const msg = `Failed to change ban expiration with message: ${emsg(error)}`;
            console.error(msg);
            console.verbose.dir(error);
            throw error;
        }
    }

    /**
     * Revoke an action (ban, warn)
     */
    revoke(
        actionId: string,
        author: string,
        allowedTypes: string[] | true = true,
        reason?: string,
    ): DatabaseActionType {
        if (typeof actionId !== 'string' || !actionId.length) throw new Error('Invalid actionId.');
        if (typeof author !== 'string' || !author.length) throw new Error('Invalid author.');
        if (allowedTypes !== true && !Array.isArray(allowedTypes)) throw new Error('Invalid allowedTypes.');

        try {
            const action = this.chain.get('actions').find({ id: actionId }).value();

            if (!action) throw new Error(`action not found`);
            if (allowedTypes !== true && !allowedTypes.includes(action.type)) {
                throw new Error(`you do not have permission to revoke this action`);
            }

            action.revocation = {
                timestamp: now(),
                author,
                ...(reason ? { reason } : {}),
            };
            this.db.writeFlag(SavePriority.HIGH);
            return structuredClone(action);
        } catch (error) {
            const msg = `Failed to revoke action with message: ${emsg(error)}`;
            console.error(msg);
            console.verbose.dir(error);
            throw error;
        }
    }

    /**
     * Returns all actions matching a lodash-style filter object.
     * Useful for querying actions without needing identifier arrays.
     * Usage: getRegisteredActions({type: 'ban'}) or getRegisteredActions({revocation: undefined})
     */
    getRegisteredActions(filter: Partial<DatabaseActionType> = {}): DatabaseActionType[] {
        return this.chain
            .get('actions')
            .filter(filter as any)
            .cloneDeep()
            .value();
    }

    /**
     * Deletes an action from the database entirely.
     */
    deleteAction(actionId: string): DatabaseActionType {
        if (typeof actionId !== 'string' || !actionId.length) throw new Error('Invalid actionId.');

        try {
            const action = this.chain.get('actions').find({ id: actionId }).cloneDeep().value();
            if (!action) throw new Error('action not found');
            this.removeFromIndex(action); // Remove from indexes
            this.chain.get('actions').remove({ id: actionId }).value();
            this.db.writeFlag(SavePriority.HIGH);
            return action;
        } catch (error) {
            const msg = `Failed to delete action with message: ${emsg(error)}`;
            console.error(msg);
            console.verbose.dir(error);
            throw error;
        }
    }
}
