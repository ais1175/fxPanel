import { z } from 'zod';
import { typeDefinedConfig } from './utils';
import { SYM_FIXER_DEFAULT } from '@lib/symbols';

const disableNuiSourceCheck = typeDefinedConfig({
    name: 'Disable NUI Source Check',
    default: false,
    validator: z.boolean(),
    fixer: SYM_FIXER_DEFAULT,
});

const limiterMinutes = typeDefinedConfig({
    name: 'Rate Limiter Minutes',
    default: 15,
    validator: z.number().int().min(1),
    fixer: SYM_FIXER_DEFAULT,
});

const limiterAttempts = typeDefinedConfig({
    name: 'Rate Limiter Attempts',
    default: 10,
    validator: z.number().int().min(5),
    fixer: SYM_FIXER_DEFAULT,
});

const useSecureCookies = typeDefinedConfig({
    name: 'Use Secure Cookies',
    default: false,
    validator: z.boolean(),
    fixer: SYM_FIXER_DEFAULT,
});

const persistSessions = typeDefinedConfig({
    name: 'Persist Sessions to Disk',
    default: false,
    validator: z.boolean(),
    fixer: SYM_FIXER_DEFAULT,
});

export default {
    disableNuiSourceCheck,
    limiterMinutes,
    limiterAttempts,
    useSecureCookies,
    persistSessions,
} as const;
