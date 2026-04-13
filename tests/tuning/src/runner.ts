import * as fs from 'fs';
import * as path from 'path';
import * as childProcess from 'child_process';
import axios from 'axios';
import { SearchAlgorithmConfig, ConfigVariant, TuningTestCase, CaseResult, VariantResult, SearchApiResponse } from './types';

const DOTNET_PATH = '/Users/andreapipino/.dotnet/dotnet';
const DOTNET_ROOT = '/Users/andreapipino/.dotnet';
const PROJECT_DIR = path.resolve(__dirname, '../../../backend/search-service/SearchService');
const TUNING_APPSETTINGS = path.join(PROJECT_DIR, 'appsettings.Tuning.json');

const TUNING_PORT = 5002;
const SERVICE_URL = `http://localhost:${TUNING_PORT}/api`;
const HEALTH_URL = `${SERVICE_URL}/search/health`;
const STARTUP_TIMEOUT_MS = 60_000;
const REQUEST_TIMEOUT_MS = 10_000;

/** Build the search service once before running variants. */
export async function buildSearchService(): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = childProcess.spawn(
      DOTNET_PATH,
      ['build', 'SearchService.csproj', '--configuration', 'Debug', '--nologo', '-v', 'q'],
      {
        cwd: PROJECT_DIR,
        env: { ...process.env, DOTNET_ROOT },
        stdio: 'pipe',
      }
    );

    let stderr = '';
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`dotnet build failed (exit ${code}):\n${stderr}`));
    });
  });
}

/** Write appsettings.Tuning.json with the given config, start the service, run all cases, then kill. */
export async function runVariant(
  variant: ConfigVariant,
  testCases: TuningTestCase[]
): Promise<VariantResult> {
  writeTuningAppSettings(variant.config);

  const proc = childProcess.spawn(
    DOTNET_PATH,
    ['run', '--no-build', '--project', 'SearchService.csproj', '--no-launch-profile'],
    {
      cwd: PROJECT_DIR,
      env: {
        ...process.env,
        DOTNET_ROOT,
        ASPNETCORE_ENVIRONMENT: 'Tuning',
        ASPNETCORE_URLS: `http://localhost:${TUNING_PORT}`,
      },
      stdio: ['ignore', 'ignore', 'pipe'],
    }
  );

  let startupStderr = '';
  proc.stderr?.on('data', (d: Buffer) => { startupStderr += d.toString(); });

  const startedAt = Date.now();

  try {
    await waitForHealth(() => startupStderr);

    const results: CaseResult[] = [];
    for (const tc of testCases) {
      const result = await scoreTestCase(tc);
      results.push(result);
    }

    const top1Count = results.filter(r => r.rank === 1).length;
    const foundCount = results.filter(r => r.found).length;

    return {
      variant,
      results,
      top1Count,
      foundCount,
      totalCases: testCases.length,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    proc.kill('SIGTERM');
    cleanupTuningAppSettings();
  }
}

// ── Internals ─────────────────────────────────────────────────────────────

function writeTuningAppSettings(config: SearchAlgorithmConfig): void {
  const appsettings = {
    Logging: { LogLevel: { Default: 'Warning', 'Microsoft.AspNetCore': 'Warning' } },
    AllowedHosts: '*',
    StandardsService: { BaseUrl: 'http://localhost:3001' },
    SearchAlgorithm: config,
  };
  fs.writeFileSync(TUNING_APPSETTINGS, JSON.stringify(appsettings, null, 2));
}

function cleanupTuningAppSettings(): void {
  try { fs.unlinkSync(TUNING_APPSETTINGS); } catch { /* ignore */ }
}

async function waitForHealth(getStderr: () => string): Promise<void> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  let lastError = '';

  while (Date.now() < deadline) {
    try {
      await axios.get(HEALTH_URL, { timeout: 2000 });
      return;
    } catch (e) {
      lastError = String(e);
      await sleep(500);
    }
  }

  const stderrHint = getStderr().slice(-500);
  throw new Error(`Service did not start within ${STARTUP_TIMEOUT_MS}ms.\nLast axios error: ${lastError}\nProcess stderr:\n${stderrHint}`);
}

async function scoreTestCase(tc: TuningTestCase): Promise<CaseResult> {
  const useRhythm = tc.ratios.length > 0;

  try {
    let data: SearchApiResponse;

    if (useRhythm) {
      const res = await axios.post<SearchApiResponse>(
        `${SERVICE_URL}/search/rhythm`,
        { intervals: tc.intervals, durationRatios: tc.ratios },
        { timeout: REQUEST_TIMEOUT_MS }
      );
      data = res.data;
    } else {
      const res = await axios.post<SearchApiResponse>(
        `${SERVICE_URL}/search`,
        { intervals: tc.intervals },
        { timeout: REQUEST_TIMEOUT_MS }
      );
      data = res.data;
    }

    if (!data.success || !data.data) {
      return { testCase: tc, rank: null, confidence: null, found: false, useRhythm };
    }

    const idx = data.data.findIndex(
      r => r.standard.title.toLowerCase() === tc.title.toLowerCase()
    );

    if (idx === -1) {
      return { testCase: tc, rank: null, confidence: null, found: false, useRhythm };
    }

    return {
      testCase: tc,
      rank: idx + 1,
      confidence: data.data[idx].confidence,
      found: true,
      useRhythm,
    };
  } catch {
    return { testCase: tc, rank: null, confidence: null, found: false, useRhythm };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
