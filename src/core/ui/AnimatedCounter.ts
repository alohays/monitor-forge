interface AnimatedCounterOptions {
  duration?: number;
  format?: (n: number) => string;
  initialValue?: number;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export class AnimatedCounter {
  private element: HTMLElement;
  private currentValue: number;
  private animationId: number | null = null;
  private duration: number;
  private formatFn: (n: number) => string;

  constructor(element: HTMLElement, options?: AnimatedCounterOptions) {
    this.element = element;
    this.duration = options?.duration ?? 400;
    this.formatFn = options?.format ?? ((n) => n.toFixed(2));
    this.currentValue = options?.initialValue ?? 0;
    this.element.textContent = this.formatFn(this.currentValue);
  }

  setValue(newValue: number): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (prefersReducedMotion() || this.currentValue === newValue) {
      this.currentValue = newValue;
      this.element.textContent = this.formatFn(newValue);
      return;
    }

    const startValue = this.currentValue;
    const startTime = performance.now();
    this.animate(startTime, startValue, newValue);
  }

  private animate(startTime: number, startVal: number, endVal: number): void {
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / this.duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = startVal + (endVal - startVal) * eased;

      this.element.textContent = this.formatFn(value);

      if (progress < 1) {
        this.animationId = requestAnimationFrame(tick);
      } else {
        this.currentValue = endVal;
        this.animationId = null;
      }
    };

    this.animationId = requestAnimationFrame(tick);
  }

  destroy(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}
