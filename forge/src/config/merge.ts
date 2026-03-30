import { type MonitorForgeConfig } from './schema.js';

export interface MergeChange {
  type: 'added' | 'updated' | 'removed';
  path: string;
  name?: string;
}

export interface MergeResult {
  config: MonitorForgeConfig;
  changes: MergeChange[];
}

/** Keys in MonitorForgeConfig whose values are arrays merged by `name`. */
const NAMED_ARRAY_KEYS: ReadonlyArray<keyof MonitorForgeConfig> = [
  'sources',
  'panels',
  'views',
  'layers',
];

/** Top-level object keys that are deep-merged. */
const DEEP_MERGE_KEYS: ReadonlyArray<keyof MonitorForgeConfig> = [
  'ai',
  'map',
  'backend',
  'theme',
  'monitor',
  'build',
];

interface DeleteMarker {
  name: string;
  _delete: true;
}

function isDeleteMarker(item: unknown): item is DeleteMarker {
  return (
    typeof item === 'object' &&
    item !== null &&
    '_delete' in item &&
    (item as Record<string, unknown>)._delete === true &&
    typeof (item as Record<string, unknown>).name === 'string'
  );
}

/**
 * Deep-merge two plain objects. Scalars in `patch` overwrite `base`.
 * Arrays in patch replace base arrays (not concatenated).
 */
function deepMergeObjects(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };

  for (const key of Object.keys(patch)) {
    const baseVal = base[key];
    const patchVal = patch[key];

    if (
      patchVal !== null &&
      typeof patchVal === 'object' &&
      !Array.isArray(patchVal) &&
      baseVal !== null &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      result[key] = deepMergeObjects(
        baseVal as Record<string, unknown>,
        patchVal as Record<string, unknown>,
      );
    } else {
      result[key] = patchVal;
    }
  }

  return result;
}

/**
 * Merge a patch into a base MonitorForgeConfig.
 *
 * - Named arrays (sources, panels, views, layers) are merged by `name` field.
 *   Items with `_delete: true` remove the matching entry. Otherwise items are
 *   added or updated (matched by name).
 * - Object fields (ai, map, backend, theme, monitor, build) are deep-merged.
 * - Scalars (version) are overwritten if present in the patch.
 * - Items not mentioned in the patch are preserved.
 */
export function mergeConfig(
  base: MonitorForgeConfig,
  patch: Record<string, unknown>,
): MergeResult {
  const changes: MergeChange[] = [];
  // Start from a shallow copy of base
  const merged: Record<string, unknown> = { ...base };

  for (const key of Object.keys(patch)) {
    const configKey = key as keyof MonitorForgeConfig;

    // Named array merge
    if (NAMED_ARRAY_KEYS.includes(configKey)) {
      const patchArray = patch[key];
      if (!Array.isArray(patchArray)) continue;

      const baseArray = (
        Array.isArray((base as Record<string, unknown>)[key])
          ? [...(base as Record<string, unknown>)[key] as unknown[]]
          : []
      ) as Array<Record<string, unknown>>;

      for (const patchItem of patchArray) {
        if (typeof patchItem !== 'object' || patchItem === null) continue;
        const item = patchItem as Record<string, unknown>;
        const itemName = item.name as string | undefined;
        if (typeof itemName !== 'string') continue;

        if (isDeleteMarker(item)) {
          const idx = baseArray.findIndex(b => b.name === itemName);
          if (idx >= 0) {
            baseArray.splice(idx, 1);
            changes.push({ type: 'removed', path: key, name: itemName });
          }
          // Non-existent delete is a no-op
        } else {
          const idx = baseArray.findIndex(b => b.name === itemName);
          if (idx >= 0) {
            baseArray[idx] = { ...baseArray[idx], ...item };
            changes.push({ type: 'updated', path: key, name: itemName });
          } else {
            baseArray.push(item);
            changes.push({ type: 'added', path: key, name: itemName });
          }
        }
      }

      merged[key] = baseArray;
      continue;
    }

    // Deep merge for object keys
    if (DEEP_MERGE_KEYS.includes(configKey)) {
      const baseObj = (base as Record<string, unknown>)[key];
      const patchObj = patch[key];

      if (
        typeof patchObj === 'object' &&
        patchObj !== null &&
        !Array.isArray(patchObj) &&
        typeof baseObj === 'object' &&
        baseObj !== null &&
        !Array.isArray(baseObj)
      ) {
        const mergedObj = deepMergeObjects(
          baseObj as Record<string, unknown>,
          patchObj as Record<string, unknown>,
        );
        // Track changes for deep-merged keys
        const patchKeys = Object.keys(patchObj as Record<string, unknown>);
        for (const subKey of patchKeys) {
          const baseSub = (baseObj as Record<string, unknown>)[subKey];
          const patchSub = (patchObj as Record<string, unknown>)[subKey];
          if (baseSub === undefined) {
            changes.push({ type: 'added', path: `${key}.${subKey}` });
          } else if (JSON.stringify(baseSub) !== JSON.stringify(patchSub)) {
            changes.push({ type: 'updated', path: `${key}.${subKey}` });
          }
        }
        merged[key] = mergedObj;
        continue;
      }
    }

    // Scalar overwrite (e.g. version)
    const baseVal = (base as Record<string, unknown>)[key];
    if (baseVal !== patch[key]) {
      if (baseVal === undefined) {
        changes.push({ type: 'added', path: key });
      } else {
        changes.push({ type: 'updated', path: key });
      }
    }
    merged[key] = patch[key];
  }

  return {
    config: merged as unknown as MonitorForgeConfig,
    changes,
  };
}
