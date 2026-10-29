'use client';

import type { ComponentType } from 'react';
import {
  Eraser,
  GripVertical,
  ImageMinus,
  Loader2,
  Pencil,
  RefreshCw,
  Wand2,
  ZoomIn,
} from 'lucide-react';

import { cn } from '@/lib/utils';

type ToolKey = 'zoom' | 'edit' | 'removeBg' | 'regen' | 'annotate' | 'erase';

/**
 * ChatGPT-style dark floating image toolbar (pill + grip + icon/label chips).
 */
export function ConceptImageToolbar({
  className,
  busy = false,
  canRefine = false,
  onZoom,
  onEdit,
  onRemoveBg,
  onRegen,
}: {
  className?: string;
  busy?: boolean;
  canRefine?: boolean;
  onZoom?: () => void;
  onEdit?: () => void;
  onRemoveBg?: () => void;
  onRegen?: () => void;
}) {
  return (
    <div
      className={cn(
        'pointer-events-auto inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-2xl border border-white/10 bg-[#2f2f2f]/95 px-1.5 py-1 shadow-[0_8px_28px_rgba(0,0,0,0.45)] backdrop-blur-md',
        className
      )}
      role="toolbar"
      aria-label="图片工具"
    >
      <span
        className="text-white/45 flex shrink-0 cursor-grab items-center px-1"
        aria-hidden
        title="拖动手柄（示意）"
      >
        <GripVertical className="size-4" />
      </span>

      <ToolBtn
        icon={ZoomIn}
        label="放大"
        onClick={onZoom}
        disabled={busy}
      />

      {canRefine && (
        <>
          <ToolBtn
            icon={Wand2}
            label="按说明改"
            title="按说明改这张"
            onClick={onEdit}
            disabled={busy}
          />
          <ToolBtn
            icon={ImageMinus}
            label="移除背景"
            onClick={onRemoveBg}
            disabled={busy}
          />
          <ToolBtn
            icon={busy ? Loader2 : RefreshCw}
            label="重生这张"
            onClick={onRegen}
            disabled={busy}
            spin={busy}
          />
          <ToolBtn
            icon={Pencil}
            label="标注"
            disabled
            title="下期"
          />
          <ToolBtn
            icon={Eraser}
            label="擦除"
            disabled
            title="下期"
          />
        </>
      )}
    </div>
  );
}

function ToolBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
  title,
  spin,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  spin?: boolean;
}) {
  return (
    <button
      type="button"
      title={title || label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={cn(
        'inline-flex shrink-0 flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 text-white/90 transition-colors',
        disabled
          ? 'cursor-not-allowed opacity-40'
          : 'hover:bg-white/10 active:bg-white/15'
      )}
    >
      <Icon className={cn('size-4', spin && 'animate-spin')} />
      <span className="whitespace-nowrap text-[10px] leading-none font-medium tracking-tight">
        {label}
      </span>
    </button>
  );
}

export type { ToolKey };
