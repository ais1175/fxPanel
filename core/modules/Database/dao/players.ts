import { DbInstance, SavePriority } from '../instance';
import { DatabasePlayerType } from '../databaseTypes';
import { DatabasePlayerSchema } from '../databaseSchemas';
import { DuplicateKeyError } from '../dbUtils';
import consoleFactory from '@lib/console';
const console = consoleFactory('DatabaseDao');

/**
 * Data access object for the database "players" collection.
 */
export default class PlayersDao {
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
     * Searches for a player in the database by the license, returns null if not found or false in case of error
     */
    findOne(license: string): DatabasePlayerType | null {
        if (!/^[0-9A-Fa-f]{40}$/.test(license)) {
            throw new Error('Invalid license format');
        }

        //Performing search
        const p = this.chain.get('players').find({ license }).cloneDeep().value();
        return typeof p === 'undefined' ? null : p;
    }

    /**
     * Register a player to the database
     */
    findMany(filter: Partial<DatabasePlayerType> | ((player: DatabasePlayerType) => boolean)): DatabasePlayerType[] {
        return this.chain
            .get('players')
            .filter(filter as any)
            .cloneDeep()
            .value();
    }

    /**
     * Register a player to the database
     */
    register(player: DatabasePlayerType): void {
        DatabasePlayerSchema.parse(player);

        //Check for duplicated license
        const found = this.chain.get('players').filter({ license: player.license }).value();
        if (found.length) throw new DuplicateKeyError(`this license is already registered`);

        this.db.writeFlag(SavePriority.LOW);
        this.chain.get('players').push(player).value();
    }

    /**
     * Updates a player setting assigning srcData props to the database player.
     * The source data object is deep cloned to prevent weird side effects.
     */
    update(
        license: string,
        srcData: Partial<Omit<DatabasePlayerType, 'license'>>,
        srcUniqueId: Symbol,
    ): DatabasePlayerType {
        if ('license' in srcData) {
            throw new Error(`cannot license field`);
        }

        const playerDbObj = this.chain.get('players').find({ license });
        if (!playerDbObj.value()) throw new Error('Player not found in database');
        this.db.writeFlag(SavePriority.LOW);
        const newData = playerDbObj.assign(structuredClone(srcData)).cloneDeep().value();
        txCore.fxPlayerlist.handleDbDataSync(newData, srcUniqueId);
        return newData;
    }

    /**
     * Revokes whitelist status of all players that match a filter function
     * @returns the number of revoked whitelists
     */
    bulkRevokeWhitelist(filterFunc: Function): number {
        if (typeof filterFunc !== 'function') throw new Error('filterFunc must be a function.');

        let cntChanged = 0;
        const srcSymbol = Symbol('bulkRevokePlayerWhitelist');
        this.dbo.data!.players.forEach((player) => {
            if (player.tsWhitelisted && filterFunc(player)) {
                cntChanged++;
                player.tsWhitelisted = undefined;
                txCore.fxPlayerlist.handleDbDataSync(structuredClone(player), srcSymbol);
            }
        });

        this.db.writeFlag(SavePriority.HIGH);
        return cntChanged;
    }

    /**
     * Deletes a player from the database entirely.
     */
    deletePlayer(license: string): void {
        if (!/^[0-9A-Fa-f]{40}$/.test(license)) {
            throw new Error('Invalid license format');
        }
        const removed = this.chain.get('players').remove({ license }).value();
        if (!removed.length) throw new Error('Player not found in database');
        this.db.writeFlag(SavePriority.HIGH);
    }

    /**
     * Wipes all identifiers of a player except the license.
     */
    wipePlayerIds(license: string): void {
        if (!/^[0-9A-Fa-f]{40}$/.test(license)) {
            throw new Error('Invalid license format');
        }
        const player = this.chain.get('players').find({ license });
        if (!player.value()) throw new Error('Player not found in database');
        const licenseId = player.value().ids.find((id: string) => id.startsWith('license:'));
        player.assign({ ids: licenseId ? [licenseId] : [] }).value();
        this.db.writeFlag(SavePriority.HIGH);
        txCore.fxPlayerlist.handleDbDataSync(structuredClone(player.cloneDeep().value()), Symbol('wipePlayerIds'));
    }

    /**
     * Wipes all HWIDs of a player.
     */
    wipePlayerHwids(license: string): void {
        if (!/^[0-9A-Fa-f]{40}$/.test(license)) {
            throw new Error('Invalid license format');
        }
        const player = this.chain.get('players').find({ license });
        if (!player.value()) throw new Error('Player not found in database');
        player.assign({ hwids: [] }).value();
        this.db.writeFlag(SavePriority.HIGH);
        txCore.fxPlayerlist.handleDbDataSync(structuredClone(player.cloneDeep().value()), Symbol('wipePlayerHwids'));
    }
}
