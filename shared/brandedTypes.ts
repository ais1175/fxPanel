/**
 * Branded types for type-safe ID handling.
 * Prevents accidentally passing one ID type where another is expected.
 *
 * Usage:
 *   const license = '0123456789abcdef...' as License;
 *   const actionId = 'B1A2-B3C4' as ActionId;
 *
 * These are structurally compatible with `string` at runtime,
 * but TypeScript will catch mix-ups at compile time.
 */
type Brand<T, B extends string> = T & { readonly __brand: B };

/** Player license hash (40-char hex string) */
export type License = Brand<string, 'License'>;

/** Action ID (ban/warn/kick, format: X###-####) */
export type ActionId = Brand<string, 'ActionId'>;

/** Ticket ID (format: TKT-#####) */
export type TicketId = Brand<string, 'TicketId'>;
