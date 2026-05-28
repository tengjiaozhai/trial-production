export function parseStoragePair(raw: string): { ddr: string; emmc: string } | null {
  const match = String(raw ?? '').replace(/\s+/g, '').match(/^(\d+)[gG]?\+(\d+)[gG]?$/);
  if (!match) return null;
  return { ddr: match[1], emmc: match[2] };
}

export function extractTrailingSize(raw: string): string {
  const text = String(raw ?? '');
  const matches = [...text.matchAll(/(\d+)\s*[gG]\b/g)];
  if (matches.length > 0) return matches[matches.length - 1][1];
  const fallback = [...text.matchAll(/(\d+)\b/g)];
  return fallback.length > 0 ? fallback[fallback.length - 1][1] : '';
}

export function validateStorageAgainstComponents(args: {
  storage: string;
  emmc: string;
  ddr: string;
}): { ok: boolean; reasons: string[] } {
  const pair = parseStoragePair(args.storage);
  if (!pair) return { ok: false, reasons: ['存储格式错误'] };

  const reasons: string[] = [];
  const emmcSize = extractTrailingSize(args.emmc);
  const ddrSize = extractTrailingSize(args.ddr);

  if (!emmcSize || emmcSize !== pair.emmc) reasons.push('flash EMMC不匹配');
  if (!ddrSize || ddrSize !== pair.ddr) reasons.push('flash DDR不匹配');

  return { ok: reasons.length === 0, reasons };
}

export function validateColorAgainstBom(args: {
  color: string;
  mbom: string;
  pbom: string;
}): { ok: boolean } {
  const color = String(args.color ?? '').trim();
  if (!color) return { ok: false };

  const mbom = String(args.mbom ?? '').trim();
  const pbom = String(args.pbom ?? '').trim();
  const mbomMatch = mbom.includes(color);
  const pbomMatch = pbom.includes(color);
  return { ok: mbomMatch || pbomMatch };
}

export function validateUnitIdVsMbId(args: {
  unitId: string;
  mbId: string;
}): { ok: boolean } {
  const unitId = String(args.unitId ?? '').trim().toUpperCase();
  const mbId = String(args.mbId ?? '').trim().toUpperCase();
  if (!unitId || !mbId) return { ok: false };
  return { ok: unitId.includes(mbId) };
}
