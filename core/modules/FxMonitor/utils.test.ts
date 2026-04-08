import { suite, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    Stopwatch,
    HealthEventMonitor,
    MonitorState,
    cleanMonitorIssuesArray,
    MonitorIssue,
    getMonitorTimeTags,
} from './utils';

suite('Stopwatch', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('should not be started by default', () => {
        const sw = new Stopwatch();
        expect(sw.started).toBe(false);
        expect(sw.elapsed).toBe(Infinity);
    });

    it('should auto-start when constructed with true', () => {
        const sw = new Stopwatch(true);
        expect(sw.started).toBe(true);
        expect(sw.elapsed).toBe(0);
    });

    it('should track elapsed time in seconds (floored)', () => {
        const sw = new Stopwatch(true);
        vi.advanceTimersByTime(2500);
        expect(sw.elapsed).toBe(2);
    });

    it('should restart correctly', () => {
        const sw = new Stopwatch();
        sw.restart();
        expect(sw.started).toBe(true);
        vi.advanceTimersByTime(5000);
        expect(sw.elapsed).toBe(5);
        sw.restart();
        expect(sw.elapsed).toBe(0);
    });

    it('should reset to stopped when not autoStart', () => {
        const sw = new Stopwatch();
        sw.restart();
        expect(sw.started).toBe(true);
        sw.reset();
        expect(sw.started).toBe(false);
        expect(sw.elapsed).toBe(Infinity);
    });

    it('should reset to restarted when autoStart', () => {
        const sw = new Stopwatch(true);
        vi.advanceTimersByTime(3000);
        sw.reset();
        expect(sw.started).toBe(true);
        expect(sw.elapsed).toBe(0);
    });

    it('isOver should return false when not started', () => {
        const sw = new Stopwatch();
        expect(sw.isOver(0)).toBe(false);
        expect(sw.isOver(10)).toBe(false);
    });

    it('isOver should correctly compare elapsed time', () => {
        const sw = new Stopwatch(true);
        vi.advanceTimersByTime(10000);
        expect(sw.isOver(10)).toBe(true);
        expect(sw.isOver(11)).toBe(false);
        expect(sw.isOver(9)).toBe(true);
    });
});

suite('HealthEventMonitor', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('should start in PENDING state', () => {
        const monitor = new HealthEventMonitor(10, 30);
        expect(monitor.status.state).toBe(MonitorState.PENDING);
        expect(monitor.status.secsSinceLast).toBe(Infinity);
        expect(monitor.status.secsSinceFirst).toBe(Infinity);
    });

    it('should transition to HEALTHY after markHealthy', () => {
        const monitor = new HealthEventMonitor(10, 30);
        monitor.markHealthy();
        expect(monitor.status.state).toBe(MonitorState.HEALTHY);
        expect(monitor.status.secsSinceLast).toBe(0);
    });

    it('should transition to DELAYED after delayLimit', () => {
        const monitor = new HealthEventMonitor(10, 30);
        monitor.markHealthy();
        vi.advanceTimersByTime(11000);
        expect(monitor.status.state).toBe(MonitorState.DELAYED);
    });

    it('should transition to FATAL after fatalLimit', () => {
        const monitor = new HealthEventMonitor(10, 30);
        monitor.markHealthy();
        vi.advanceTimersByTime(31000);
        expect(monitor.status.state).toBe(MonitorState.FATAL);
    });

    it('should stay HEALTHY if markHealthy is called before delayLimit', () => {
        const monitor = new HealthEventMonitor(10, 30);
        monitor.markHealthy();
        vi.advanceTimersByTime(5000);
        monitor.markHealthy();
        vi.advanceTimersByTime(5000);
        expect(monitor.status.state).toBe(MonitorState.HEALTHY);
    });

    it('should track secsSinceFirst correctly', () => {
        const monitor = new HealthEventMonitor(10, 30);
        monitor.markHealthy();
        vi.advanceTimersByTime(5000);
        expect(monitor.status.secsSinceFirst).toBe(5);
        monitor.markHealthy(); // second call shouldn't reset firstHealthyEvent
        vi.advanceTimersByTime(5000);
        expect(monitor.status.secsSinceFirst).toBe(10);
    });

    it('should reset back to PENDING', () => {
        const monitor = new HealthEventMonitor(10, 30);
        monitor.markHealthy();
        vi.advanceTimersByTime(5000);
        monitor.reset();
        expect(monitor.status.state).toBe(MonitorState.PENDING);
        expect(monitor.status.secsSinceFirst).toBe(Infinity);
    });
});

suite('cleanMonitorIssuesArray', () => {
    it('should return empty array for undefined', () => {
        expect(cleanMonitorIssuesArray(undefined)).toEqual([]);
    });

    it('should return empty array for non-array', () => {
        expect(cleanMonitorIssuesArray('not an array' as any)).toEqual([]);
    });

    it('should filter out falsy values', () => {
        expect(cleanMonitorIssuesArray([null, undefined, '', false] as any)).toEqual([]);
    });

    it('should pass through string issues', () => {
        expect(cleanMonitorIssuesArray(['issue1', 'issue2'])).toEqual(['issue1', 'issue2']);
    });

    it('should extract MonitorIssue .all members', () => {
        const issue = new MonitorIssue('Test Issue');
        issue.addInfo('info1');
        issue.addDetail('detail1');
        expect(cleanMonitorIssuesArray([issue])).toEqual(['Test Issue', 'info1', 'detail1']);
    });

    it('should handle mixed string and MonitorIssue', () => {
        const issue = new MonitorIssue('Complex');
        issue.addInfo('extra');
        expect(cleanMonitorIssuesArray(['simple', issue])).toEqual(['simple', 'Complex', 'extra']);
    });
});

suite('MonitorIssue', () => {
    it('should store title, infos, and details', () => {
        const issue = new MonitorIssue('Title');
        issue.addInfo('info');
        issue.addDetail('detail');
        expect(issue.all).toEqual(['Title', 'info', 'detail']);
    });

    it('should allow setTitle', () => {
        const issue = new MonitorIssue('Old');
        issue.setTitle('New');
        expect(issue.title).toBe('New');
        expect(issue.all[0]).toBe('New');
    });

    it('should ignore undefined info/detail', () => {
        const issue = new MonitorIssue('Title');
        issue.addInfo(undefined);
        issue.addDetail(undefined);
        expect(issue.all).toEqual(['Title']);
    });
});

suite('getMonitorTimeTags', () => {
    it('should format finite values', () => {
        const hb = { state: MonitorState.HEALTHY, secsSinceLast: 5, secsSinceFirst: 100 };
        const hc = { state: MonitorState.HEALTHY, secsSinceLast: 3, secsSinceFirst: 100 };
        const tags = getMonitorTimeTags(hb, hc, 600);
        expect(tags.simple).toContain('HB:');
        expect(tags.simple).toContain('HC:');
        expect(tags.withProc).toContain('P:');
    });

    it('should handle Infinity values with --', () => {
        const hb = { state: MonitorState.PENDING, secsSinceLast: Infinity, secsSinceFirst: Infinity };
        const hc = { state: MonitorState.PENDING, secsSinceLast: Infinity, secsSinceFirst: Infinity };
        const tags = getMonitorTimeTags(hb, hc, 0);
        expect(tags.simple).toContain('HB:--');
        expect(tags.simple).toContain('HC:--');
    });
});
