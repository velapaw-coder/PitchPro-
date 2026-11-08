'use client';

import { ArrowRight, Loader2 } from 'lucide-react';

import type { ProposalVideoEntryDecision } from '@/modules/pitchpro/proposal-video-gate';
import { Button } from '@/components/ui/button';

/**
 * Phone and desktop: the control is always in the document (full width, no
 * breakpoint hide). When the proposal is not actually exported, it stays
 * visible and lists what is missing instead of disappearing.
 */
export function ProposalVideoEntry({
  decision,
  entering,
  onEnter,
}: {
  decision: ProposalVideoEntryDecision;
  entering?: boolean;
  onEnter: () => void;
}) {
  return (
    <div
      className="flex w-full flex-col gap-2"
      data-proposal-video-entry=""
      data-allow={decision.allow ? 'true' : 'false'}
    >
      {!decision.allow && decision.blockers.length > 0 && (
        <div
          role="status"
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-950 dark:text-amber-100"
        >
          <p className="font-medium">还不能进入场景视频</p>
          <ul className="mt-1 list-disc pl-4">
            {decision.blockers.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {decision.notices.length > 0 && (
        <ul className="text-muted-foreground list-disc pl-4 text-[11px] leading-relaxed">
          {decision.notices.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      <Button
        type="button"
        size="sm"
        className="w-full gap-1.5"
        disabled={!decision.allow || !!entering}
        onClick={onEnter}
      >
        {entering ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            进入中…
          </>
        ) : (
          <>
            <ArrowRight className="size-3.5" />
            确认提案，进入场景视频
          </>
        )}
      </Button>
    </div>
  );
}
