'use client';

import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Wand2, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

import { ConceptImageToolbar } from './concept-image-toolbar';

/** Full-screen image viewer with ChatGPT-like toolbar + edit footer. */
export function ImageLightbox({
  src,
  alt,
  open,
  onClose,
  designId,
  onRefine,
  busy = false,
}: {
  src: string | null;
  alt?: string;
  open: boolean;
  onClose: () => void;
  designId?: string | null;
  onRefine?: (
    designId: string,
    instruction: string,
    mode: 'edit' | 'regen' | 'remove-bg'
  ) => Promise<void> | void;
  busy?: boolean;
}) {
  const [instruction, setInstruction] = useState('');
  const [showEdit, setShowEdit] = useState(true);
  const canEdit = !!(designId && onRefine);

  useEffect(() => {
    if (!open) return;
    setInstruction('');
    setShowEdit(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, busy, src]);

  if (!open || !src) return null;

  async function submitEdit() {
    if (!designId || !onRefine || busy) return;
    const text = instruction.trim();
    if (!text) return;
    await onRefine(designId, text, 'edit');
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt || '图片预览'}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/85 p-3 sm:p-6"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <button
        type="button"
        aria-label="关闭"
        disabled={busy}
        className="absolute top-3 right-3 z-[101] rounded-full bg-white/15 p-2 text-white hover:bg-white/25 disabled:opacity-50"
        onClick={(e) => {
          e.stopPropagation();
          if (!busy) onClose();
        }}
      >
        <X className="size-5" />
      </button>

      <div
        className="relative flex max-h-[min(90vh,960px)] w-full max-w-5xl flex-1 items-start justify-center overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Full-res URL (no next/image downscale); tall PDP long images scroll at same ratio */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt || '预览'}
          className={cn(
            'h-auto w-auto max-w-[min(96vw,720px)] rounded-lg object-contain shadow-2xl',
            busy && 'opacity-70'
          )}
        />
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-sm text-white">
              <Loader2 className="size-4 animate-spin" />
              正在改这张…
            </span>
          </div>
        )}
        {canEdit && (
          <div className="absolute bottom-3 left-1/2 z-[102] -translate-x-1/2">
            <ConceptImageToolbar
              busy={busy}
              canRefine
              onZoom={() => setShowEdit(true)}
              onEdit={() => setShowEdit(true)}
              onRemoveBg={() => {
                if (!designId || !onRefine) return;
                void onRefine(designId, '', 'remove-bg');
              }}
              onRegen={() => {
                if (!designId || !onRefine) return;
                void onRefine(designId, '', 'regen');
              }}
            />
          </div>
        )}
      </div>

      {canEdit && showEdit && (
        <div
          className="mt-3 w-full max-w-3xl rounded-2xl border border-white/15 bg-black/70 p-3 shadow-xl backdrop-blur-md"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-2 text-[11px] text-white/70">
            写清要改的细节（文字、材质、颜色等）。只换这一张，不影响另外三张。
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              disabled={busy}
              rows={2}
              placeholder="例如：把瓶盖改成哑光金色；去掉包装上的英文小字"
              className="placeholder:text-white/35 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white outline-none focus:border-white/40 disabled:opacity-60"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void submitEdit();
                }
              }}
            />
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="gap-1.5"
                disabled={busy || !instruction.trim()}
                onClick={() => void submitEdit()}
              >
                {busy ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Wand2 className="size-3.5" />
                )}
                按说明改这张
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                disabled={busy}
                onClick={() => {
                  if (!designId || !onRefine) return;
                  void onRefine(designId, '', 'regen');
                }}
              >
                <RefreshCw className="size-3.5" />
                重生这张
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
