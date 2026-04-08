const psidRegex = /^(?<mutex>\w{5})#(?<netid>\d{1,6})(?:r(?<rollover>\d{1,3}))?$/;

export type PlayerSessionIdParts = {
    mutex: string;
    netid: number;
    rollover: number;
};

/**
 * Parses a player session ID string like "Ab3xK#42" or "Ab3xK#42r1".
 * Returns the parsed parts, defaulting rollover to 0 if not present.
 */
export const parsePlayerSessionId = (psid: string): PlayerSessionIdParts | undefined => {
    const match = psid.match(psidRegex);
    if (!match?.groups) return undefined;
    return {
        mutex: match.groups.mutex,
        netid: parseInt(match.groups.netid),
        rollover: match.groups.rollover ? parseInt(match.groups.rollover) : 0,
    };
};

/**
 * Builds a player session ID string from its parts.
 * Format: "mutex#netid" for rollover 0, "mutex#netidrN" for rollover N > 0.
 */
export const buildPlayerSessionId = (mutex: string, netid: number, rollover: number) => {
    if (rollover > 0) {
        return `${mutex}#${netid}r${rollover}`;
    }
    return `${mutex}#${netid}`;
};
