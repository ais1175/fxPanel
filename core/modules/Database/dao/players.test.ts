import { suite, it, expect, vi, beforeEach } from 'vitest';
import PlayersDao from './players';
import { DuplicateKeyError } from '../dbUtils';
import type { DatabasePlayerType } from '../databaseTypes';

// Minimal mock of the lodash chain interface used by lowdb
function createMockDb() {
    let players: DatabasePlayerType[] = [];

    const chainValue = {
        get: vi.fn((collection: string) => {
            if (collection !== 'players') throw new Error('Unexpected collection');
            return {
                find: vi.fn((filter: any) => {
                    const found = players.find((p) => Object.entries(filter).every(([k, v]) => (p as any)[k] === v));
                    return {
                        cloneDeep: vi.fn(() => ({
                            value: vi.fn(() => (found ? structuredClone(found) : undefined)),
                        })),
                        value: vi.fn(() => found),
                        assign: vi.fn((data: any) => {
                            if (found) Object.assign(found, data);
                            return {
                                cloneDeep: vi.fn(() => ({
                                    value: vi.fn(() => (found ? structuredClone(found) : undefined)),
                                })),
                                value: vi.fn(() => found),
                            };
                        }),
                    };
                }),
                filter: vi.fn((filterOrFn: any) => {
                    let filtered: DatabasePlayerType[];
                    if (typeof filterOrFn === 'function') {
                        filtered = players.filter(filterOrFn);
                    } else {
                        filtered = players.filter((p) =>
                            Object.entries(filterOrFn).every(([k, v]) => (p as any)[k] === v),
                        );
                    }
                    return {
                        cloneDeep: vi.fn(() => ({
                            value: vi.fn(() => structuredClone(filtered)),
                        })),
                        value: vi.fn(() => filtered),
                    };
                }),
                push: vi.fn((player: DatabasePlayerType) => {
                    players.push(player);
                    return { value: vi.fn() };
                }),
                remove: vi.fn((filter: any) => {
                    const removed = players.filter((p) =>
                        Object.entries(filter).every(([k, v]) => (p as any)[k] === v),
                    );
                    const remaining = players.filter(
                        (p) => !Object.entries(filter).every(([k, v]) => (p as any)[k] === v),
                    );
                    players.length = 0;
                    players.push(...remaining);
                    return { value: vi.fn(() => removed) };
                }),
            };
        }),
    };

    const db = {
        obj: { chain: chainValue, data: { players } },
        isReady: true,
        writeFlag: vi.fn(),
    };

    return { db, players, getPlayers: () => players, setPlayers: (p: DatabasePlayerType[]) => (players = p) };
}

const validPlayer: DatabasePlayerType = {
    license: 'a'.repeat(40),
    ids: ['steam:123', 'discord:456'],
    hwids: ['hwid1'],
    displayName: 'TestPlayer',
    pureName: 'testplayer',
    playTime: 100,
    tsLastConnection: 1700000000,
    tsJoined: 1690000000,
};

vi.stubGlobal('txCore', {
    fxPlayerlist: {
        handleDbDataSync: vi.fn(),
    },
});

suite('PlayersDao', () => {
    let dao: PlayersDao;
    let mockDb: ReturnType<typeof createMockDb>;

    beforeEach(() => {
        mockDb = createMockDb();
        dao = new PlayersDao(mockDb.db as any);
        vi.clearAllMocks();
    });

    suite('findOne', () => {
        it('should throw on invalid license format', () => {
            expect(() => dao.findOne('invalid')).toThrow('Invalid license format');
            expect(() => dao.findOne('')).toThrow('Invalid license format');
            expect(() => dao.findOne('zz' + 'a'.repeat(38))).toThrow('Invalid license format');
        });

        it('should return null when player not found', () => {
            const result = dao.findOne('b'.repeat(40));
            expect(result).toBeNull();
        });
    });

    suite('register', () => {
        it('should register a valid player', () => {
            dao.register({ ...validPlayer });
            expect(mockDb.db.writeFlag).toHaveBeenCalled();
        });

        it('should throw on invalid player data (Zod validation)', () => {
            expect(() => dao.register({ ...validPlayer, license: '' })).toThrow();
        });

        it('should throw DuplicateKeyError for existing license', () => {
            // Pre-populate
            mockDb.getPlayers().push({ ...validPlayer });
            expect(() => dao.register({ ...validPlayer })).toThrow(DuplicateKeyError);
        });
    });

    suite('deletePlayer', () => {
        it('should throw on invalid license format', () => {
            expect(() => dao.deletePlayer('bad')).toThrow('Invalid license format');
        });
    });

    suite('wipePlayerIds', () => {
        it('should throw on invalid license format', () => {
            expect(() => dao.wipePlayerIds('bad')).toThrow('Invalid license format');
        });
    });

    suite('wipePlayerHwids', () => {
        it('should throw on invalid license format', () => {
            expect(() => dao.wipePlayerHwids('bad')).toThrow('Invalid license format');
        });
    });

    suite('update', () => {
        it('should throw when trying to update license field', () => {
            expect(() => dao.update('a'.repeat(40), { license: 'new' } as any, Symbol('test'))).toThrow(
                'cannot modify license field',
            );
        });
    });

    suite('bulkRevokeWhitelist', () => {
        it('should throw if filterFunc is not a function', () => {
            expect(() => dao.bulkRevokeWhitelist('notafunc' as any)).toThrow('filterFunc must be a function');
        });
    });
});
