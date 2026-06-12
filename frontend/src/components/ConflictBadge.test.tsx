// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ConflictBadge } from './ConflictBadge';

describe('ConflictBadge', () => {
  it('renders nothing when count is 0', () => {
    const { container } = render(<ConflictBadge count={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders "N 个冲突待处理" when count is positive', () => {
    const { getByTestId } = render(<ConflictBadge count={3} />);
    expect(getByTestId('conflict-badge').textContent).toBe('3 个冲突待处理');
  });

  it('renders a red dot indicator', () => {
    const { getByTestId } = render(<ConflictBadge count={1} />);
    const dot = getByTestId('conflict-dot');
    expect(dot).toBeTruthy();
  });

  it('handles count of 1 without plural form issues', () => {
    const { getByTestId } = render(<ConflictBadge count={1} />);
    expect(getByTestId('conflict-badge').textContent).toBe('1 个冲突待处理');
  });

  it('handles large counts', () => {
    const { getByTestId } = render(<ConflictBadge count={99} />);
    expect(getByTestId('conflict-badge').textContent).toBe('99 个冲突待处理');
  });
});
