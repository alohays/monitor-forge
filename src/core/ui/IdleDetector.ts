const IDLE_TIMEOUT_MS = 120_000; // 2 minutes
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;

export class IdleDetector {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private boundReset: () => void;
  private boundVisibility: () => void;

  constructor() {
    this.boundReset = this.reset.bind(this);
    this.boundVisibility = this.onVisibilityChange.bind(this);

    for (const event of ACTIVITY_EVENTS) {
      document.addEventListener(event, this.boundReset, { passive: true });
    }
    document.addEventListener('visibilitychange', this.boundVisibility);

    this.scheduleIdle();
  }

  private scheduleIdle(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      document.body.classList.add('animations-paused');
    }, IDLE_TIMEOUT_MS);
  }

  private reset(): void {
    document.body.classList.remove('animations-paused');
    this.scheduleIdle();
  }

  private onVisibilityChange(): void {
    if (document.hidden) {
      document.body.classList.add('animations-paused');
      if (this.timer !== null) {
        clearTimeout(this.timer);
        this.timer = null;
      }
    } else {
      document.body.classList.remove('animations-paused');
      this.scheduleIdle();
    }
  }

  destroy(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    for (const event of ACTIVITY_EVENTS) {
      document.removeEventListener(event, this.boundReset);
    }
    document.removeEventListener('visibilitychange', this.boundVisibility);
    document.body.classList.remove('animations-paused');
  }
}
