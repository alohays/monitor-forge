// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IdleDetector } from './IdleDetector.js';

describe('IdleDetector', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.classList.remove('animations-paused');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds animations-paused class after 2 minute idle', () => {
    const detector = new IdleDetector();

    expect(document.body.classList.contains('animations-paused')).toBe(false);

    // Advance just under 2 minutes — should not be paused yet
    vi.advanceTimersByTime(119_999);
    expect(document.body.classList.contains('animations-paused')).toBe(false);

    // Advance past 2 minutes
    vi.advanceTimersByTime(1);
    expect(document.body.classList.contains('animations-paused')).toBe(true);

    detector.destroy();
  });

  it('resets timer on user activity', () => {
    const detector = new IdleDetector();

    // Advance 1.5 minutes
    vi.advanceTimersByTime(90_000);
    expect(document.body.classList.contains('animations-paused')).toBe(false);

    // User moves mouse — should reset timer
    document.dispatchEvent(new MouseEvent('mousedown'));

    // Advance another 1.5 minutes — should NOT be paused (timer was reset)
    vi.advanceTimersByTime(90_000);
    expect(document.body.classList.contains('animations-paused')).toBe(false);

    // Advance to 2 minutes from last activity — should be paused now
    vi.advanceTimersByTime(30_000);
    expect(document.body.classList.contains('animations-paused')).toBe(true);

    detector.destroy();
  });

  it('removes paused class on user interaction after idle', () => {
    const detector = new IdleDetector();

    // Go idle
    vi.advanceTimersByTime(120_000);
    expect(document.body.classList.contains('animations-paused')).toBe(true);

    // User interacts
    document.dispatchEvent(new MouseEvent('mousedown'));
    expect(document.body.classList.contains('animations-paused')).toBe(false);

    detector.destroy();
  });

  it('pauses on visibility hidden, resumes on visible', () => {
    const detector = new IdleDetector();

    // Simulate tab hidden
    Object.defineProperty(document, 'hidden', { value: true, writable: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(document.body.classList.contains('animations-paused')).toBe(true);

    // Simulate tab visible
    Object.defineProperty(document, 'hidden', { value: false, writable: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(document.body.classList.contains('animations-paused')).toBe(false);

    detector.destroy();
  });

  it('destroy cleans up class and event listeners', () => {
    const detector = new IdleDetector();

    // Go idle
    vi.advanceTimersByTime(120_000);
    expect(document.body.classList.contains('animations-paused')).toBe(true);

    detector.destroy();
    expect(document.body.classList.contains('animations-paused')).toBe(false);

    // After destroy, further timeouts should not re-add the class
    vi.advanceTimersByTime(120_000);
    expect(document.body.classList.contains('animations-paused')).toBe(false);
  });
});
