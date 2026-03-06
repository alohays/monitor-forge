import type { Map as MaplibreMap } from 'maplibre-gl';

export class IdleRotation {
  private map: MaplibreMap;
  private speed: number;
  private idleTimeout: number;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private animFrameId: number | null = null;
  private lastFrameTime = 0;
  private isRotating = false;
  private boundPause: () => void;
  private boundScheduleResume: () => void;
  private boundOnWheel: () => void;

  constructor(map: MaplibreMap, speed = 0.5, idleTimeoutMs = 30_000) {
    this.map = map;
    this.speed = speed;
    this.idleTimeout = idleTimeoutMs;
    this.boundPause = this.pause.bind(this);
    this.boundScheduleResume = this.scheduleResume.bind(this);
    this.boundOnWheel = this.onWheel.bind(this);
  }

  enable(): void {
    const canvas = this.map.getCanvas();
    canvas.addEventListener('mousedown', this.boundPause);
    canvas.addEventListener('touchstart', this.boundPause);
    canvas.addEventListener('wheel', this.boundOnWheel);
    canvas.addEventListener('mouseup', this.boundScheduleResume);
    canvas.addEventListener('touchend', this.boundScheduleResume);
    this.scheduleResume();
  }

  private scheduleResume(): void {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.timeoutId = setTimeout(() => this.startRotation(), this.idleTimeout);
  }

  private pause(): void {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.stopRotation();
  }

  private onWheel(): void {
    this.stopRotation();
    this.scheduleResume();
  }

  private startRotation(): void {
    if (this.isRotating) return;
    this.isRotating = true;
    this.lastFrameTime = performance.now();
    this.tick();
  }

  private tick(): void {
    if (!this.isRotating) return;
    const now = performance.now();
    const delta = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;

    const center = this.map.getCenter();
    center.lng += this.speed * delta;
    this.map.setCenter(center);

    this.animFrameId = requestAnimationFrame(() => this.tick());
  }

  private stopRotation(): void {
    this.isRotating = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  disable(): void {
    this.stopRotation();
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    const canvas = this.map.getCanvas();
    canvas.removeEventListener('mousedown', this.boundPause);
    canvas.removeEventListener('touchstart', this.boundPause);
    canvas.removeEventListener('wheel', this.boundOnWheel);
    canvas.removeEventListener('mouseup', this.boundScheduleResume);
    canvas.removeEventListener('touchend', this.boundScheduleResume);
  }
}
