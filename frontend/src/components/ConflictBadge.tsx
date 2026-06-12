import React from 'react';

interface ConflictBadgeProps {
  count: number;
}

export function ConflictBadge({ count }: ConflictBadgeProps) {
  if (count <= 0) return null;

  return (
    <span
      data-testid="conflict-badge"
      className="inline-flex items-center gap-1.5 text-[11px] font-black text-rose-600"
    >
      <span
        data-testid="conflict-dot"
        className="inline-block w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_0_3px_rgba(244,63,94,0.18)]"
        aria-hidden="true"
      />
      {count} 个冲突待处理
    </span>
  );
}
