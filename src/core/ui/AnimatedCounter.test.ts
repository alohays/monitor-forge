// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnimatedCounter } from './AnimatedCounter.js';

describe('AnimatedCounter', () => {
  let element: HTMLSpanElement;

  beforeEach(() => {
    element = document.createElement('span');
    document.body.appendChild(element);
  });

  afterEach(() => {
    element.remove();
  });

  it('sets initial value text on construction', () => {
    const counter = new AnimatedCounter(element, { initialValue: 42.5 });
    expect(element.textContent).toBe('42.50');
    counter.destroy();
  });

  it('uses custom format function', () => {
    const counter = new AnimatedCounter(element, {
      initialValue: 3,
      format: (n) => `$${n.toFixed(0)}`,
    });
    expect(element.textContent).toBe('$3');
    counter.destroy();
  });

  it('defaults to 0 when no initialValue given', () => {
    const counter = new AnimatedCounter(element);
    expect(element.textContent).toBe('0.00');
    counter.destroy();
  });

  it('skips animation when value is the same', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');
    const counter = new AnimatedCounter(element, { initialValue: 10 });

    counter.setValue(10);
    expect(rafSpy).not.toHaveBeenCalled();
    expect(element.textContent).toBe('10.00');

    counter.destroy();
    rafSpy.mockRestore();
  });

  it('skips animation when prefers-reduced-motion is active', () => {
    const matchMediaSpy = vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
    } as MediaQueryList);

    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');
    const counter = new AnimatedCounter(element, { initialValue: 10 });

    counter.setValue(50);
    expect(rafSpy).not.toHaveBeenCalled();
    expect(element.textContent).toBe('50.00');

    counter.destroy();
    matchMediaSpy.mockRestore();
    rafSpy.mockRestore();
  });

  it('starts animation via requestAnimationFrame for value changes', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);

    const counter = new AnimatedCounter(element, { initialValue: 0 });
    counter.setValue(100);

    expect(rafSpy).toHaveBeenCalled();

    counter.destroy();
    vi.restoreAllMocks();
  });

  it('cancels previous animation when setValue called again', () => {
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(42);
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);

    const counter = new AnimatedCounter(element, { initialValue: 0 });
    counter.setValue(50);
    counter.setValue(100);

    expect(cancelSpy).toHaveBeenCalledWith(42);

    counter.destroy();
    vi.restoreAllMocks();
  });

  it('destroy cancels pending animation', () => {
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(99);
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);

    const counter = new AnimatedCounter(element, { initialValue: 0 });
    counter.setValue(100);
    counter.destroy();

    expect(cancelSpy).toHaveBeenCalledWith(99);
    vi.restoreAllMocks();
  });
});
