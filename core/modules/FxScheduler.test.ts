import { suite, it, expect, vi, beforeEach, afterEach } from 'vitest';
import FxScheduler from './FxScheduler';

// Mock txCore and txConfig before importing
vi.stubGlobal('txCore', {
    webServer: {
        webSocket: { pushRefresh: vi.fn() },
    },
    fxRunner: {
        sendEvent: vi.fn(),
        child: null,
    },
    fxMonitor: {
        currentStatus: 'ONLINE',
    },
    translator: {
        t: vi.fn((key: string) => key),
    },
    discordBot: {
        sendAnnouncement: vi.fn(),
    },
});
vi.stubGlobal('txConfig', {
    restarter: {
        schedule: [],
        intervalHours: 0,
        bootGracePeriod: 30,
    },
    general: {
        serverName: 'TestServer',
    },
});

suite('FxScheduler', () => {
    let scheduler: FxScheduler;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.mocked(txCore.webServer.webSocket.pushRefresh).mockClear();
        vi.mocked(txCore.fxRunner.sendEvent).mockClear();
        scheduler = new FxScheduler();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    suite('getStatus', () => {
        it('should return false nextRelativeMs when no schedule configured', () => {
            vi.advanceTimersByTime(100); // let setImmediate run
            const status = scheduler.getStatus();
            expect(status.nextRelativeMs).toBe(false);
            expect(status.nextSkip).toBe(false);
            expect(status.nextIsTemp).toBe(false);
        });
    });

    suite('setNextTempSchedule', () => {
        it('should throw for non-string input', () => {
            expect(() => scheduler.setNextTempSchedule(123 as any)).toThrow('expected string');
        });

        it('should throw for invalid relative minutes', () => {
            expect(() => scheduler.setNextTempSchedule('+0')).toThrow('invalid minutes');
            expect(() => scheduler.setNextTempSchedule('+1440')).toThrow('invalid minutes');
            expect(() => scheduler.setNextTempSchedule('+abc')).toThrow('invalid minutes');
            expect(() => scheduler.setNextTempSchedule('+-5')).toThrow('invalid minutes');
        });

        it('should accept valid relative minutes', () => {
            expect(() => scheduler.setNextTempSchedule('+30')).not.toThrow();
            const status = scheduler.getStatus();
            expect(status.nextIsTemp).toBe(true);
            expect(status.nextRelativeMs).toBeGreaterThan(0);
        });

        it('should throw for invalid absolute time hours', () => {
            expect(() => scheduler.setNextTempSchedule('25:00')).toThrow('invalid hours');
            expect(() => scheduler.setNextTempSchedule('ab:00')).toThrow('invalid hours');
        });

        it('should throw for invalid absolute time minutes', () => {
            expect(() => scheduler.setNextTempSchedule('12:60')).toThrow('invalid minutes');
            expect(() => scheduler.setNextTempSchedule('12:ab')).toThrow('invalid minutes');
        });

        it('should set temp schedule and push UI refresh', () => {
            scheduler.setNextTempSchedule('+60');
            expect(txCore.webServer.webSocket.pushRefresh).toHaveBeenCalledWith('status');
        });
    });

    suite('setNextSkip', () => {
        it('should enable skip for temp schedule', () => {
            scheduler.setNextTempSchedule('+30');
            scheduler.setNextSkip(true, 'testAdmin');
            const status = scheduler.getStatus();
            // After skipping a temp schedule, tempSchedule is cleared
            expect(status.nextIsTemp).toBe(false);
        });

        it('should disable skip', () => {
            scheduler.setNextTempSchedule('+30');
            scheduler.setNextSkip(true, 'testAdmin');
            // Skipping a temp schedule clears it without setting nextSkip
            expect(scheduler.getStatus().nextSkip).toBe(false);

            scheduler.setNextSkip(false);
            const status = scheduler.getStatus();
            expect(status.nextSkip).toBe(false);
        });
    });

    suite('handleServerClose', () => {
        it('should clear temp schedule on server close', () => {
            scheduler.setNextTempSchedule('+30');
            scheduler.handleServerClose();
            // temp schedule should be cleared
            const status = scheduler.getStatus();
            expect(status.nextIsTemp).toBe(false);
        });
    });
});
