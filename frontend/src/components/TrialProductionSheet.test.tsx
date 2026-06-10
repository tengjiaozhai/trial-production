// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrialProductionSheet } from './TrialProductionSheet';
import type { FieldDefinition } from '../types';

vi.mock('@univerjs/presets', () => ({
  createUniver: vi.fn(() => ({
    univer: { dispose: vi.fn() },
    univerAPI: {},
  })),
  LocaleType: { ZH_CN: 'zh-CN' },
  mergeLocales: vi.fn((...args: unknown[]) => Object.assign({}, ...args)),
}));

vi.mock('@univerjs/preset-sheets-core', () => ({
  UniverSheetsCorePreset: vi.fn(() => ({})),
}));

vi.mock('@univerjs/preset-sheets-core/locales/zh-CN', () => ({
  default: { ui: {} },
}));

vi.mock('@univerjs/core/facade', () => ({
  FUniver: {
    newAPI: vi.fn(() => ({
      Event: { SheetEditEnded: 'SheetEditEnded' },
      addEvent: vi.fn(() => ({ dispose: vi.fn() })),
      getActiveWorkbook: vi.fn(() => null),
    })),
  },
}));

const baseFields: FieldDefinition[] = [
  { id: 'project', label: '项目名称', group: '基本信息', behavior: 'auto' },
];

describe('TrialProductionSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a sheet host container', () => {
    render(
      <TrialProductionSheet
        currentStep={3}
        skuData={[]}
        activeFields={baseFields}
        onUpdateValue={vi.fn()}
      />
    );
    const container = screen.getByTestId('trial-production-sheet');
    expect(container).toBeInTheDocument();
    expect(container.tagName).toBe('DIV');
  });

  it('applies custom className', () => {
    render(
      <TrialProductionSheet
        currentStep={3}
        skuData={[]}
        activeFields={baseFields}
        onUpdateValue={vi.fn()}
        className="custom-class"
      />
    );
    const container = screen.getByTestId('trial-production-sheet');
    expect(container).toHaveClass('custom-class');
  });

  it('sets full width and height styles', () => {
    render(
      <TrialProductionSheet
        currentStep={3}
        skuData={[]}
        activeFields={baseFields}
        onUpdateValue={vi.fn()}
      />
    );
    const container = screen.getByTestId('trial-production-sheet');
    expect(container.style.width).toBe('100%');
    expect(container.style.height).toBe('100%');
  });
});
