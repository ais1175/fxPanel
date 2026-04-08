/**
 * Standardized application error class.
 * Throw this from routes/middleware to produce a consistent { error } JSON response.
 * The topLevelMw catches these and sets the HTTP status + body automatically.
 */
export class AppError extends Error {
    readonly httpStatus: number;

    constructor(message: string, httpStatus = 400) {
        super(message);
        this.name = 'AppError';
        this.httpStatus = httpStatus;
    }
}
