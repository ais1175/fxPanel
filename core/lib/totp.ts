/**
 * Standalone TOTP utility module.
 * All 2FA cryptographic logic is isolated here for easy removal.
 * No dependencies on AdminStore, sessions, or routes.
 */
import { TOTP, Secret } from 'otpauth';
import { randomBytes, createHash } from 'node:crypto';

const TOTP_ISSUER = 'fxPanel';
const TOTP_PERIOD = 30;
const TOTP_DIGITS = 6;
const TOTP_ALGORITHM = 'SHA1';
const BACKUP_CODE_COUNT = 10;

/**
 * Generate a new TOTP secret
 */
export function generateTotpSecret(): string {
    const secret = new Secret({ size: 20 });
    return secret.base32;
}

/**
 * Generate the otpauth:// URI for QR code rendering
 */
export function getTotpUri(secret: string, accountName: string): string {
    const totp = new TOTP({
        issuer: TOTP_ISSUER,
        label: accountName,
        algorithm: TOTP_ALGORITHM,
        digits: TOTP_DIGITS,
        period: TOTP_PERIOD,
        secret: Secret.fromBase32(secret),
    });
    return totp.toString();
}

/**
 * Verify a TOTP code against a secret.
 * Allows 1 window of drift (previous + current + next period).
 */
export function verifyTotpCode(secret: string, code: string): boolean {
    const totp = new TOTP({
        issuer: TOTP_ISSUER,
        algorithm: TOTP_ALGORITHM,
        digits: TOTP_DIGITS,
        period: TOTP_PERIOD,
        secret: Secret.fromBase32(secret),
    });
    const delta = totp.validate({ token: code, window: 1 });
    return delta !== null;
}

/**
 * Generate backup codes (plaintext + hashed pairs)
 */
export function generateBackupCodes(): { plaintext: string[]; hashed: string[] } {
    const plaintext: string[] = [];
    const hashed: string[] = [];
    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
        const code = randomBytes(4).toString('hex'); // 8 char hex codes
        plaintext.push(code);
        hashed.push(hashBackupCode(code));
    }
    return { plaintext, hashed };
}

/**
 * Hash a backup code for storage (SHA-256, not reversible)
 */
export function hashBackupCode(code: string): string {
    return createHash('sha256').update(code.toLowerCase().trim()).digest('hex');
}

/**
 * Verify a backup code against hashed list.
 * Returns the index of the matched code, or -1 if not found.
 */
export function verifyBackupCode(code: string, hashedCodes: string[]): number {
    const hashed = hashBackupCode(code);
    return hashedCodes.indexOf(hashed);
}
