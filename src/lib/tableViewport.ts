import type { SKUData, StepId } from '../types';

const INDEX_COL_WIDTH = 32;
const FIELD_COL_WIDTH = 120;

export const BASIC_INFO_BLOCK_HEIGHT_PX = 200;

export interface TableViewportMetrics {
  totalTableWidthPx: number;
  topTableWidthPx: number;
  bottomTableWidthPx: number;
  totalValueColumns: number;
  basicInfoColSpan: number;
  bodyColSpan: number;
  basicInfoBlockHeightPx: number;
  hasBodyScrollableRegion: boolean;
}

export function buildTableViewportMetrics(args: {
  currentStep: StepId | number;
  skuData: SKUData[];
  colWidths: Record<string, number>;
}): TableViewportMetrics {
  const supplyColumns = args.skuData.reduce((acc, sku) => acc + sku.supplies.length, 0);
  const totalValueColumns = supplyColumns;
  const supplyWidthPx = args.skuData.reduce(
    (acc, sku) => acc + sku.supplies.reduce((sum, supply) => sum + (args.colWidths[supply.id] ?? 140), 0),
    0,
  );

  const totalTableWidthPx =
    INDEX_COL_WIDTH +
    FIELD_COL_WIDTH +
    supplyWidthPx;

  return {
    totalTableWidthPx,
    topTableWidthPx: totalTableWidthPx,
    bottomTableWidthPx: totalTableWidthPx,
    totalValueColumns,
    basicInfoColSpan: 2 + totalValueColumns,
    bodyColSpan: 2 + totalValueColumns,
    basicInfoBlockHeightPx: BASIC_INFO_BLOCK_HEIGHT_PX,
    hasBodyScrollableRegion: true,
  };
}
