import maplibregl from 'maplibre-gl';
import {
  DayNightOverlay,
  getSolarPosition,
  generateTerminatorGeoJSON,
} from '../../src/core/map/overlays/DayNightOverlay.js';
import { AtmosphereGlow } from '../../src/core/map/overlays/AtmosphereGlow.js';
import { IdleRotation } from '../../src/core/map/overlays/IdleRotation.js';
import { ProjectionToggle } from '../../src/core/map/controls/ProjectionToggle.js';
import type { GeoJSONSource } from 'maplibre-gl';

// ─── State ──────────────────────────────────────────────────────
interface State {
  dayNight: boolean;
  atmosphere: boolean;
  rotation: boolean;
  projection: 'globe' | 'mercator';
  timeOffsetMs: number;
  idleTimeoutMs: number;
}

const state: State = {
  dayNight: true,
  atmosphere: true,
  rotation: true,
  projection: 'globe',
  timeOffsetMs: 0,
  idleTimeoutMs: 30_000,
};

let dayNightOverlay: DayNightOverlay | null = null;
let atmosphereGlow: AtmosphereGlow | null = null;
let idleRotation: IdleRotation | null = null;

function now(): Date {
  return new Date(Date.now() + state.timeOffsetMs);
}

// ─── Map Init ───────────────────────────────────────────────────
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  center: [30, 30],
  zoom: 3,
  minZoom: 2,
  maxZoom: 18,
  attributionControl: false,
});

// Projection toggle control
map.addControl(
  new ProjectionToggle('globe', (p) => onProjectionChange(p)),
  'top-right',
);
map.addControl(new maplibregl.NavigationControl(), 'top-right');

map.on('load', () => {
  map.setProjection({ type: 'globe' });

  // Day/Night
  dayNightOverlay = new DayNightOverlay(map);
  dayNightOverlay.enable();

  // Atmosphere
  atmosphereGlow = new AtmosphereGlow(map);
  atmosphereGlow.enable();

  // Idle rotation
  idleRotation = new IdleRotation(map, 0.3, state.idleTimeoutMs);
  idleRotation.enable();

  // Click-to-zoom (same as MapEngine)
  map.on('click', (e) => {
    const features = map.queryRenderedFeatures(e.point);
    const hit = features.find((f) => f.layer?.id !== 'day-night-fill');
    if (!hit) return;

    const geom = hit.geometry;
    const center: [number, number] =
      geom.type === 'Point'
        ? (geom.coordinates as [number, number])
        : [e.lngLat.lng, e.lngLat.lat];

    idleRotation?.disable();
    map.flyTo({ center, zoom: 5, pitch: 30, duration: 1500 });
    map.once('moveend', () => {
      if (state.rotation && idleRotation) {
        recreateRotation();
      }
    });
  });

  // Start time-warp terminator updater (replaces the built-in 60s interval)
  setInterval(() => {
    if (!state.dayNight) return;
    const source = map.getSource('day-night-terminator') as GeoJSONSource | undefined;
    if (source) {
      source.setData(generateTerminatorGeoJSON(now()));
    }
  }, 2000); // Update every 2s for time-warp responsiveness
});

// ─── Overlay Helpers ────────────────────────────────────────────
function onProjectionChange(projection: 'mercator' | 'globe'): void {
  state.projection = projection;
  if (projection === 'globe' && state.atmosphere) {
    atmosphereGlow?.enable();
  } else {
    atmosphereGlow?.disable();
  }
  updateBtnStates();
}

function recreateRotation(): void {
  idleRotation?.disable();
  idleRotation = new IdleRotation(map, 0.3, state.idleTimeoutMs);
  idleRotation.enable();
}

// ─── Checklist ──────────────────────────────────────────────────
const CHECKS = [
  'Globe renders in 3D spherical projection',
  'Day/Night terminator visible on nightside',
  'Terminator position matches current UTC time',
  'Atmospheric glow visible around globe edge',
  'Glow fades as you zoom in past level 5',
  'Idle rotation starts after 30s idle',
  'Rotation pauses on mouse/touch interaction',
  'Rotation pauses on wheel scroll, resumes after 30s',
  '2D/3D toggle button visible in top-right',
  'Toggle to 2D: mercator, atmosphere disables',
  'Toggle to 3D: globe restores, atmosphere re-enables',
  'Click on map feature triggers flyTo',
  'flyTo: zoom 5, pitch 30\u00B0, 1.5s smooth animation',
  'Rotation pauses during flyTo, resumes after',
  'Day/night overlay persists through projection toggle',
];

const checklistEl = document.getElementById('checklist')!;
const counterEl = document.getElementById('check-counter')!;

CHECKS.forEach((text, i) => {
  const label = document.createElement('label');
  label.className = 'check-item';
  label.innerHTML = `<input type="checkbox" data-idx="${i}"><span>${text}</span>`;
  checklistEl.appendChild(label);
});

checklistEl.addEventListener('change', () => {
  const boxes = checklistEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
  let checked = 0;
  boxes.forEach((b) => {
    const item = b.closest('.check-item')!;
    if (b.checked) {
      item.classList.add('done');
      checked++;
    } else {
      item.classList.remove('done');
    }
  });
  counterEl.innerHTML = `<b>${checked}</b>/${CHECKS.length}`;
});

// ─── Debug Panel ────────────────────────────────────────────────
const dUtc = document.getElementById('d-utc')!;
const dDecl = document.getElementById('d-decl')!;
const dSubLng = document.getElementById('d-sublng')!;
const dCenter = document.getElementById('d-center')!;
const dZoom = document.getElementById('d-zoom')!;
const dProj = document.getElementById('d-proj')!;
const dRotation = document.getElementById('d-rotation')!;
const utcClock = document.getElementById('utc-clock')!;

function updateDebug(): void {
  const d = now();
  const { declination, subSolarLng } = getSolarPosition(d);
  const declDeg = (declination * 180) / Math.PI;

  dUtc.textContent = d.toISOString().replace('T', ' ').slice(0, 19) + 'Z';
  utcClock.textContent = d.toISOString().slice(11, 19) + 'Z';
  dDecl.textContent = declDeg.toFixed(4) + '\u00B0';
  dSubLng.textContent = subSolarLng.toFixed(4) + '\u00B0';

  if (map.loaded()) {
    const c = map.getCenter();
    dCenter.textContent = `[${c.lng.toFixed(2)}, ${c.lat.toFixed(2)}]`;
    dZoom.textContent = map.getZoom().toFixed(2);
  }

  dProj.textContent = state.projection.toUpperCase();

  // Infer rotation state from IdleRotation internals
  // We can't access private fields, so track via state
  if (!state.rotation) {
    dRotation.innerHTML = '<span class="badge off">Disabled</span>';
  } else {
    // Heuristic: if center is changing, we're rotating
    dRotation.innerHTML = '<span class="badge on">Enabled</span>';
  }

  if (state.timeOffsetMs !== 0) {
    const hours = state.timeOffsetMs / 3600000;
    dUtc.textContent += ` (${hours > 0 ? '+' : ''}${hours}h)`;
    dUtc.classList.add('warn');
  } else {
    dUtc.classList.remove('warn');
  }
}

setInterval(updateDebug, 500);

// ─── Controls ───────────────────────────────────────────────────
const btnDayNight = document.getElementById('btn-daynight') as HTMLButtonElement;
const btnAtmos = document.getElementById('btn-atmos') as HTMLButtonElement;
const btnRotation = document.getElementById('btn-rotation') as HTMLButtonElement;
const btnProjection = document.getElementById('btn-projection') as HTMLButtonElement;
const btnTwBack = document.getElementById('btn-tw-back') as HTMLButtonElement;
const btnTwFwd = document.getElementById('btn-tw-fwd') as HTMLButtonElement;
const btnIdle5s = document.getElementById('btn-idle5s') as HTMLButtonElement;
const btnForceRotate = document.getElementById('btn-force-rotate') as HTMLButtonElement;
const btnReset = document.getElementById('btn-reset') as HTMLButtonElement;

function updateBtnStates(): void {
  btnDayNight.classList.toggle('active', state.dayNight);
  btnAtmos.classList.toggle('active', state.atmosphere && state.projection === 'globe');
  btnRotation.classList.toggle('active', state.rotation);
  btnProjection.classList.toggle('active', state.projection === 'globe');
  btnProjection.innerHTML =
    state.projection === 'globe' ? 'Globe &rarr; 2D' : '2D &rarr; Globe';
}

btnDayNight.addEventListener('click', () => {
  state.dayNight = !state.dayNight;
  if (state.dayNight) {
    dayNightOverlay?.disable();
    dayNightOverlay = new DayNightOverlay(map);
    dayNightOverlay.enable();
    // Apply time warp immediately
    const src = map.getSource('day-night-terminator') as GeoJSONSource | undefined;
    if (src) src.setData(generateTerminatorGeoJSON(now()));
  } else {
    dayNightOverlay?.disable();
    dayNightOverlay = null;
  }
  updateBtnStates();
});

btnAtmos.addEventListener('click', () => {
  state.atmosphere = !state.atmosphere;
  if (state.atmosphere && state.projection === 'globe') {
    if (!atmosphereGlow) atmosphereGlow = new AtmosphereGlow(map);
    atmosphereGlow.enable();
  } else {
    atmosphereGlow?.disable();
  }
  updateBtnStates();
});

btnRotation.addEventListener('click', () => {
  state.rotation = !state.rotation;
  if (state.rotation) {
    recreateRotation();
  } else {
    idleRotation?.disable();
  }
  updateBtnStates();
});

btnProjection.addEventListener('click', () => {
  const newProj = state.projection === 'globe' ? 'mercator' : 'globe';
  state.projection = newProj;
  map.setProjection({ type: newProj });
  if (newProj === 'globe') {
    map.flyTo({ zoom: Math.min(map.getZoom(), 5), duration: 600 });
    if (state.atmosphere) {
      if (!atmosphereGlow) atmosphereGlow = new AtmosphereGlow(map);
      atmosphereGlow.enable();
    }
  } else {
    map.flyTo({ pitch: 0, duration: 600 });
    atmosphereGlow?.disable();
  }
  updateBtnStates();
});

btnTwBack.addEventListener('click', () => {
  state.timeOffsetMs -= 6 * 3600 * 1000;
  // Force terminator update
  const src = map.getSource('day-night-terminator') as GeoJSONSource | undefined;
  if (src) src.setData(generateTerminatorGeoJSON(now()));
});

btnTwFwd.addEventListener('click', () => {
  state.timeOffsetMs += 6 * 3600 * 1000;
  const src = map.getSource('day-night-terminator') as GeoJSONSource | undefined;
  if (src) src.setData(generateTerminatorGeoJSON(now()));
});

btnIdle5s.addEventListener('click', () => {
  state.idleTimeoutMs = 5000;
  if (state.rotation) recreateRotation();
  btnIdle5s.textContent = 'Idle 5s \u2713';
  setTimeout(() => {
    btnIdle5s.textContent = 'Idle 5s';
  }, 2000);
});

btnForceRotate.addEventListener('click', () => {
  state.rotation = true;
  state.idleTimeoutMs = 100; // near-instant start
  recreateRotation();
  updateBtnStates();
  // Restore normal timeout after rotation starts
  setTimeout(() => {
    state.idleTimeoutMs = 30_000;
  }, 500);
});

btnReset.addEventListener('click', () => {
  // Teardown
  dayNightOverlay?.disable();
  atmosphereGlow?.disable();
  idleRotation?.disable();

  // Reset state
  state.dayNight = true;
  state.atmosphere = true;
  state.rotation = true;
  state.projection = 'globe';
  state.timeOffsetMs = 0;
  state.idleTimeoutMs = 30_000;

  // Rebuild
  map.setProjection({ type: 'globe' });
  map.flyTo({ center: [30, 30], zoom: 3, pitch: 0, duration: 800 });

  dayNightOverlay = new DayNightOverlay(map);
  dayNightOverlay.enable();

  atmosphereGlow = new AtmosphereGlow(map);
  atmosphereGlow.enable();

  idleRotation = new IdleRotation(map, 0.3, state.idleTimeoutMs);
  idleRotation.enable();

  updateBtnStates();
});
