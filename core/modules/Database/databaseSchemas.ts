import { z } from 'zod';

//Player
export const DatabasePlayerSchema = z.object({
    license: z.string().min(1),
    ids: z.array(z.string()),
    hwids: z.array(z.string()),
    displayName: z.string(),
    pureName: z.string(),
    playTime: z.number().nonnegative(),
    tsLastConnection: z.number(),
    tsJoined: z.number(),
    tsWhitelisted: z.number().optional(),
    notes: z
        .object({
            text: z.string(),
            lastAdmin: z.string().nullable(),
            tsLastEdit: z.number().nullable(),
        })
        .optional(),
    nameHistory: z.array(z.string()).optional(),
    sessionHistory: z.array(z.tuple([z.string(), z.number()])).optional(),
    customTags: z.array(z.string()).optional(),
});

//Actions
const DatabaseActionBaseSchema = z.object({
    id: z.string().min(1),
    ids: z.array(z.string()),
    playerName: z.union([z.string(), z.literal(false)]),
    reason: z.string(),
    author: z.string(),
    timestamp: z.number(),
    revocation: z
        .object({
            timestamp: z.number(),
            author: z.string(),
        })
        .optional(),
});
export const DatabaseActionSchema = z.discriminatedUnion('type', [
    DatabaseActionBaseSchema.extend({
        type: z.literal('ban'),
        hwids: z.array(z.string()).optional(),
        expiration: z.union([z.number(), z.literal(false)]),
    }),
    DatabaseActionBaseSchema.extend({
        type: z.literal('warn'),
        acked: z.boolean(),
    }),
    DatabaseActionBaseSchema.extend({
        type: z.literal('kick'),
    }),
]);

//Whitelist
export const DatabaseWhitelistApprovalSchema = z.object({
    identifier: z.string().min(1),
    playerName: z.string(),
    playerAvatar: z.string().nullable(),
    tsApproved: z.number(),
    approvedBy: z.string(),
});

export const DatabaseWhitelistRequestSchema = z.object({
    id: z.string().min(1),
    license: z.string().min(1),
    playerDisplayName: z.string(),
    playerPureName: z.string(),
    discordTag: z.string().optional(),
    discordAvatar: z.string().optional(),
    tsLastAttempt: z.number(),
});
