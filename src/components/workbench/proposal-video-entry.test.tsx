import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { evaluateProposalVideoEntry } from '@/modules/pitchpro/proposal-video-gate';

import { ProposalVideoEntry } from './proposal-video-entry';

function markup(input: Parameters<typeof evaluateProposalVideoEntry>[0]) {
  const decision = evaluateProposalVideoEntry(input);
  return renderToStaticMarkup(
    createElement(ProposalVideoEntry, {
      decision,
      onEnter: () => {},
    })
  );
}

test('exported proposal shows a full-width enabled entry on a narrow layout', () => {
  const html = markup({
    lockedDesign: true,
    projectStage: 'proposal',
    fileUrl: '',
    workflow: {
      stage: 'EXPORT_PDF',
      missingData: ['Sample lead time'],
    },
  });
  assert.match(html, /确认提案，进入场景视频/);
  assert.match(html, /data-allow="true"/);
  assert.match(html, /class="[^"]*\bw-full\b/);
  assert.doesNotMatch(
    html,
    /(?:^|[\s"'])(?:hidden|sm:hidden|md:hidden|max-sm:hidden)(?:[\s"']|$)/
  );
  assert.doesNotMatch(html, /\sdisabled(?:=|"|\s|>)/);
  assert.match(html, /Sample lead time/);
  assert.match(html, /不阻止进入场景视频/);
});

test('incomplete proposal keeps the entry visible and names the gap', () => {
  const html = markup({
    lockedDesign: true,
    projectStage: 'proposal',
    workflow: { stage: 'VISUAL_REVIEW', approvedVisualCount: 0 },
  });
  assert.match(html, /data-allow="false"/);
  assert.match(html, /还不能进入场景视频/);
  assert.match(html, /视觉确认/);
  assert.match(html, /确认提案，进入场景视频/);
  assert.match(html, /\sdisabled=""/);
  assert.match(html, /class="[^"]*\bw-full\b/);
  assert.doesNotMatch(
    html,
    /(?:^|[\s"'])(?:hidden|sm:hidden|md:hidden|max-sm:hidden)(?:[\s"']|$)/
  );
});
