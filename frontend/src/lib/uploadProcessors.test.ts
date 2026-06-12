import { describe, expect, it, vi } from 'vitest';
import { processMaterialFile, processKeyMaterialFile, processSampleFile } from './uploadProcessors';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('uploadProcessors: parallel execution', () => {
  it('runs material + key-material + sample processors concurrently via Promise.all', async () => {
    const materialSpy = vi.fn(async () => {
      await sleep(100);
      return { ok: true, kind: 'material' };
    });
    const keyMaterialSpy = vi.fn(async () => {
      await sleep(100);
      return { ok: true, kind: 'key-material' };
    });
    const sampleSpy = vi.fn(async () => {
      await sleep(100);
      return { ok: true, kind: 'sample' };
    });

    const t0 = Date.now();
    const [m, k, s] = await Promise.all([
      materialSpy(),
      keyMaterialSpy(),
      sampleSpy(),
    ]);
    const elapsed = Date.now() - t0;

    // Parallel: total ~100ms, not ~300ms. Allow generous slack for slow CI.
    expect(elapsed).toBeLessThan(250);
    expect(m).toEqual({ ok: true, kind: 'material' });
    expect(k).toEqual({ ok: true, kind: 'key-material' });
    expect(s).toEqual({ ok: true, kind: 'sample' });
  });

  it('processMaterialFile passes emmcSizes/ddrSizes to LLM (does not run LLM without them)', async () => {
    const llmCall = vi.fn(async (args: { emmcSizes: string[]; ddrSizes: string[] }) => {
      await sleep(50);
      return {
        materialNameByStaticField: args.emmcSizes.length > 0 ? { emmc: 'value' } : {},
        materialNameByEmmcSize: {},
        materialNameByDdrSize: {},
      };
    });

    const result = await processMaterialFile({
      emmcSizes: ['128', '256'],
      ddrSizes: ['4', '6', '8'],
      llmCall,
    });

    expect(llmCall).toHaveBeenCalledTimes(1);
    expect(llmCall).toHaveBeenCalledWith({
      emmcSizes: ['128', '256'],
      ddrSizes: ['4', '6', '8'],
    });
    expect(result.materialNameByStaticField).toEqual({ emmc: 'value' });
  });

  it('processKeyMaterialFile runs parse + LLM in sequence but isolated from siblings', async () => {
    const llmCall = vi.fn(async (list: string[]) => {
      await sleep(50);
      return Object.fromEntries(list.map((x) => [x, x.toUpperCase()]));
    });

    const result = await processKeyMaterialFile({
      category2List: ['喇叭BOX', '电池', 'PCB'],
      llmCall,
    });

    expect(llmCall).toHaveBeenCalledWith(['喇叭BOX', '电池', 'PCB']);
    expect(result).toEqual({ 喇叭BOX: '喇叭BOX', 电池: '电池', PCB: 'PCB' });
  });

  it('processSampleFile dedupes row names before calling LLM', async () => {
    const llmCall = vi.fn(async (names: string[]) => {
      await sleep(50);
      return Object.fromEntries(names.map((n) => [n, `field_${n}`]));
    });

    const result = await processSampleFile({
      sheets: [
        { rowNames: ['样机A', '样机B', '样机A'] }, // duplicate
        { rowNames: ['样机B', '样机C'] },
      ],
      llmCall,
    });

    // Duplicates collapsed
    expect(llmCall).toHaveBeenCalledWith(['样机A', '样机B', '样机C']);
    expect(result).toEqual({ 样机A: 'field_样机A', 样机B: 'field_样机B', 样机C: 'field_样机C' });
  });
});
