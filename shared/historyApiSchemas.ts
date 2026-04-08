import { z } from 'zod';

export const addLegacyBanBodySchema = z.object({
    identifiers: z.string().array(),
    reason: z.string().trim().min(3).max(2048),
    duration: z.string(),
});
export type ApiAddLegacyBanReqSchema = z.infer<typeof addLegacyBanBodySchema>;

export const revokeActionBodySchema = z.object({
    actionId: z.string(),
    reason: z.string().trim().max(512).optional(),
});
export type ApiRevokeActionReqSchema = z.infer<typeof revokeActionBodySchema>;

export const deleteActionBodySchema = z.object({
    actionId: z.string(),
});
export type ApiDeleteActionReqSchema = z.infer<typeof deleteActionBodySchema>;

export const changeBanDurationBodySchema = z.object({
    actionId: z.string(),
    duration: z.string(),
});
export type ApiChangeBanDurationReqSchema = z.infer<typeof changeBanDurationBodySchema>;
