import { describe, it, expect, vi, beforeEach } from 'vitest';
import { matchCategory2WithLLM } from '../keyMaterialTemplate';
import { matchManagedMaterialNamesWithLLM } from '../managedMaterialCore';
import { matchSampleCollectionRowsWithLLM } from '../sampleCollectionWorkbook';

describe('LLM single-flight + cache', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('keyMaterial: same input reuses cache (groupA+groupB fetch called once per call)', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), { status: 200 }) as any
    );
    const list = ['电池', '喇叭'];
    await matchCategory2WithLLM(list);
    await matchCategory2WithLLM(list);
    // 1st call fires groupA + groupB (2 fetch). 2nd call hits cache (0 fetch). Total = 2.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('managedMaterial: same input reuses cache (static+storage fetch called once per call)', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), { status: 200 }) as any
    );
    const args = {
      materialNames: ['电池', '喇叭'],
      emmcSizes: ['128'],
      ddrSizes: ['4'],
    };
    await matchManagedMaterialNamesWithLLM(args);
    await matchManagedMaterialNamesWithLLM(args);
    // 1st call fires static + storage (2 fetch). 2nd call hits cache (0 fetch). Total = 2.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('sampleCollection: same input reuses cache (groupA+groupB fetch called once per call)', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] }), { status: 200 }) as any
    );
    const rows = ['硬件测试', '软件'];
    await matchSampleCollectionRowsWithLLM(rows);
    await matchSampleCollectionRowsWithLLM(rows);
    // 1st call fires groupA + groupB (2 fetch). 2nd call hits cache (0 fetch). Total = 2.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
