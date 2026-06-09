// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StepsIndicator } from './StepsIndicator';

describe('StepsIndicator', () => {
  it('expanded: renders all 5 step names', () => {
    render(
      <StepsIndicator
        currentStep={1}
        collapsed={false}
        onToggleCollapsed={() => {}}
      />
    );
    expect(screen.getByText('填写必填项')).toBeInTheDocument();
    expect(screen.getByText('自动获取')).toBeInTheDocument();
    expect(screen.getByText('补充完善')).toBeInTheDocument();
    expect(screen.getByText('计算与校验')).toBeInTheDocument();
    expect(screen.getByText('导出预览')).toBeInTheDocument();
  });

  it('expanded: renders a toggle button with accessible label', () => {
    render(
      <StepsIndicator
        currentStep={1}
        collapsed={false}
        onToggleCollapsed={() => {}}
      />
    );
    const btn = screen.getByTestId('steps-toggle');
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('aria-label');
  });

  it('expanded: clicking toggle calls onToggleCollapsed once', () => {
    const onToggle = vi.fn();
    render(
      <StepsIndicator
        currentStep={1}
        collapsed={false}
        onToggleCollapsed={onToggle}
      />
    );
    fireEvent.click(screen.getByTestId('steps-toggle'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('collapsed: shows only the current step id, not full step names', () => {
    render(
      <StepsIndicator
        currentStep={2}
        collapsed={true}
        onToggleCollapsed={() => {}}
      />
    );
    const collapsed = screen.getByTestId('collapsed-current-step');
    expect(collapsed).toBeInTheDocument();
    expect(collapsed.textContent).toContain('2');
    expect(screen.queryByText('填写必填项')).not.toBeInTheDocument();
    expect(screen.queryByText('自动获取')).not.toBeInTheDocument();
    expect(screen.queryByText('补充完善')).not.toBeInTheDocument();
    expect(screen.queryByText('计算与校验')).not.toBeInTheDocument();
    expect(screen.queryByText('导出预览')).not.toBeInTheDocument();
  });

  it('collapsed: step bar uses compact height class (h-7)', () => {
    const { container } = render(
      <StepsIndicator
        currentStep={3}
        collapsed={true}
        onToggleCollapsed={() => {}}
      />
    );
    const root = container.firstElementChild;
    expect(root).not.toBeNull();
    expect(root!.className).toMatch(/\bh-7\b/);
  });

  it('collapsed: clicking toggle also calls onToggleCollapsed', () => {
    const onToggle = vi.fn();
    render(
      <StepsIndicator
        currentStep={1}
        collapsed={true}
        onToggleCollapsed={onToggle}
      />
    );
    fireEvent.click(screen.getByTestId('steps-toggle'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
