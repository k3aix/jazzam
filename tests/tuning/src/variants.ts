import { SearchAlgorithmConfig, ConfigVariant } from './types';

type NestedKey = (string | number)[];

function getNestedValue(obj: Record<string, unknown>, keys: NestedKey): unknown {
  let cur: unknown = obj;
  for (const key of keys) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key as string];
  }
  return cur;
}

function setNestedValue(
  obj: Record<string, unknown>,
  keys: NestedKey,
  value: unknown
): void {
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i] as string;
    cur = cur[key] as Record<string, unknown>;
  }
  cur[keys[keys.length - 1] as string] = value;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Generate One-At-a-Time (OAT) variants from the baseline config.
 *
 * Each variant changes exactly one parameter, keeping all others at baseline.
 * The baseline itself is always included as the first entry.
 */
export function generateOATVariants(baseline: SearchAlgorithmConfig): ConfigVariant[] {
  const variants: ConfigVariant[] = [
    { name: 'baseline', description: 'Production config (no changes)', config: deepClone(baseline) },
  ];

  // ── Numeric parameters: vary ±10% and ±20% ──────────────────────────────
  const numericParams: Array<{ path: NestedKey; label: string }> = [
    { path: ['DefaultErrorTolerance'],            label: 'ErrorTolerance' },
    { path: ['DefaultMinConfidence'],             label: 'MinConfidence' },
    { path: ['DefaultPitchWeight'],               label: 'PitchWeight' },
    { path: ['RhythmErrorTolerance'],             label: 'RhythmErrorTol' },
    { path: ['EnhancedScoring', 'ConsecutiveMissPenalty'], label: 'ConsecMissPenalty' },
    { path: ['CompressedSearch', 'ConfidencePenalty'],     label: 'CompressedPenalty' },
    { path: ['CorrectionDetection', 'MaxCorrectionRate'],  label: 'MaxCorrectionRate' },
  ];

  for (const { path: p, label } of numericParams) {
    const baseVal = getNestedValue(baseline as unknown as Record<string, unknown>, p) as number;
    for (const factor of [0.8, 0.9, 1.1, 1.2]) {
      const newVal = round3(baseVal * factor);
      const config = deepClone(baseline);
      setNestedValue(config as unknown as Record<string, unknown>, p, newVal);
      const sign = factor > 1 ? '+' : '';
      variants.push({
        name: `${label}_x${factor}`,
        description: `${p.join('.')} = ${newVal} (${sign}${Math.round((factor - 1) * 100)}%)`,
        config,
      });
    }
  }

  // ── Integer parameters: try alternative values ───────────────────────────
  const intParams: Array<{ path: NestedKey; label: string; options: number[] }> = [
    { path: ['MinimumIntervals'],                          label: 'MinIntervals',    options: [3, 4, 5, 6] },
    { path: ['EnhancedScoring', 'ConsecutiveMissThreshold'], label: 'ConsecThreshold', options: [2, 3, 4, 5] },
    { path: ['CompressedSearch', 'ZeroGroupSize'],          label: 'ZeroGroupSize',  options: [2, 3, 4, 5, 6] },
    { path: ['CorrectionDetection', 'MaxWidth'],           label: 'CorrectionMaxWidth', options: [1, 2, 3] },
    { path: ['CorrectionDetection', 'MaxSequenceLength'],  label: 'CorrectionMaxSeq',   options: [8, 10, 12, 15] },
  ];

  for (const { path: p, label, options } of intParams) {
    const baseVal = getNestedValue(baseline as unknown as Record<string, unknown>, p) as number;
    for (const val of options) {
      if (val === baseVal) continue;
      const config = deepClone(baseline);
      setNestedValue(config as unknown as Record<string, unknown>, p, val);
      variants.push({
        name: `${label}_${val}`,
        description: `${p.join('.')} = ${val}`,
        config,
      });
    }
  }

  // ── Boolean parameters: toggle ───────────────────────────────────────────
  const boolParams: Array<{ path: NestedKey; label: string }> = [
    { path: ['EnablePositionBias'],              label: 'PositionBias' },
    { path: ['EnhancedScoring', 'Enabled'],      label: 'EnhancedScoring' },
    { path: ['CorrectionDetection', 'Enabled'],  label: 'CorrectionDetection' },
    { path: ['CompressedSearch', 'Enabled'],     label: 'CompressedSearch' },
  ];

  for (const { path: p, label } of boolParams) {
    const baseVal = getNestedValue(baseline as unknown as Record<string, unknown>, p) as boolean;
    const config = deepClone(baseline);
    setNestedValue(config as unknown as Record<string, unknown>, p, !baseVal);
    variants.push({
      name: `${label}_${!baseVal}`,
      description: `${p.join('.')} = ${!baseVal} (was ${baseVal})`,
      config,
    });
  }

  return variants;
}
