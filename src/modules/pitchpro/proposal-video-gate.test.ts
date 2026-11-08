import assert from 'node:assert/strict';
import test from 'node:test';

import {
  bumpReachedStep,
  evaluateProposalVideoEntry,
  type ProposalWorkflowSnapshot,
} from './proposal-video-gate';

const disneyOutline = `# 迪士尼 (待确认具体IP分支) · Brand Product Concept Proposal
Opportunity · Product · Market (OPM) · Unsolicited Concept Proposal

## 1. Cover claim (P01)

Created for the brand
`;

function exportedState(extra: Record<string, unknown> = {}): string {
  const state = {
    stage: 'EXPORT_PDF',
    pageSummary:
      '本提案视觉位 5 张（默认顺序 hero / long / packaging / retail / 多角度）：hero、long、packaging、retail_story、product_concept',
    missingData: [
      'Sample lead time',
      'Contact name/email (recommended before export)',
    ],
    visualTasks: [
      { visual_id: 'hero', status: 'approved', assetUrl: '/media?path=a.png' },
      { visual_id: 'long', status: 'approved', assetUrl: '/media?path=b.png' },
    ],
    ...extra,
  };
  return `${disneyOutline}\n<<<PROPOSAL_STATE\n${JSON.stringify(state)}\nPROPOSAL_STATE>>>`;
}

test('old exported API path unlocks scene video and survives a second read', () => {
  const input = {
    lockedDesign: true,
    projectStage: 'proposal',
    fileUrl: '/api/pitchpro/projects/p1/proposal-pdf',
    content:
      'outline\n<<<PROPOSAL_PDF_STORAGE\nr2:proposals/p1.pdf\nPROPOSAL_PDF_STORAGE>>>',
  };
  const first = evaluateProposalVideoEntry(input);
  const refreshed = evaluateProposalVideoEntry(input);
  assert.equal(first.allow, true);
  assert.equal(first.unlockStep, true);
  assert.deepEqual(first.blockers, []);
  assert.deepEqual(refreshed, first);
  assert.equal(bumpReachedStep('proposal', first.unlockStep), 'video');
});

test('already-exported project with only EXPORT_PDF state and empty fileUrl unlocks', () => {
  const decision = evaluateProposalVideoEntry({
    lockedDesign: true,
    projectStage: 'proposal',
    fileUrl: '',
    content: exportedState(),
  });
  assert.equal(decision.allow, true);
  assert.equal(decision.workflowStage, 'EXPORT_PDF');
  assert.equal(decision.blockers.length, 0);
  assert.ok(decision.notices.some((item) => item.includes('Sample lead time')));
  assert.ok(
    decision.notices.every((item) => item.includes('不阻止进入场景视频'))
  );
  assert.equal(bumpReachedStep('产品提案', decision.unlockStep), 'video');
});

test('EXPORT_PDF from the API workflow field unlocks when content has no marker', () => {
  const workflow: ProposalWorkflowSnapshot = {
    stage: 'EXPORT_PDF',
    missingData: ['Sample lead time'],
  };
  const decision = evaluateProposalVideoEntry({
    lockedDesign: true,
    projectStage: 'proposal',
    fileUrl: '',
    content: disneyOutline,
    workflow,
  });
  assert.equal(decision.allow, true);
  assert.equal(decision.unlockStep, true);
  assert.deepEqual(decision.blockers, []);
});

test('r2 key and media?path without a leading slash count as an exported PDF', () => {
  for (const fileUrl of [
    'r2:pitchpro/proposals/disney.pdf',
    'media?path=proposals/disney.pdf',
    '/media?path=proposals/disney.pdf',
    'enterprise-uploads/proposals/disney.pdf',
  ]) {
    const decision = evaluateProposalVideoEntry({
      lockedDesign: true,
      projectStage: 'proposal',
      fileUrl,
      content: disneyOutline,
    });
    assert.equal(decision.allow, true, fileUrl);
    assert.equal(decision.hasPdfArtifact, true, fileUrl);
  }
});

test('normal pre-export stages stay blocked and name the missing step', () => {
  const visual = evaluateProposalVideoEntry({
    lockedDesign: true,
    projectStage: 'proposal',
    fileUrl: '',
    content: '',
    workflow: {
      stage: 'VISUAL_REVIEW',
      approvedVisualCount: 1,
      missingData: ['Sample lead time'],
    },
  });
  assert.equal(visual.allow, false);
  assert.equal(visual.unlockStep, false);
  assert.match(visual.summary, /视觉确认/);
  assert.match(visual.summary, /已批准 1 张/);
  assert.match(visual.summary, /2 张/);
  assert.ok(visual.notices.some((item) => item.includes('Sample lead time')));
  assert.equal(bumpReachedStep('proposal', visual.unlockStep), 'proposal');

  const pdfReady = evaluateProposalVideoEntry({
    lockedDesign: true,
    projectStage: 'proposal',
    workflow: { stage: 'PDF_READY' },
  });
  assert.equal(pdfReady.allow, false);
  assert.match(pdfReady.summary, /导出检查/);
  assert.match(pdfReady.summary, /确定生成 PDF/);

  const draft = evaluateProposalVideoEntry({
    lockedDesign: true,
    projectStage: 'proposal',
    workflow: { stage: 'DRAFT' },
  });
  assert.match(draft.summary, /草案大纲/);

  const legacy = evaluateProposalVideoEntry({
    lockedDesign: true,
    projectStage: 'proposal',
  });
  assert.match(legacy.summary, /尚未生成 PDF/);
});

test('missing lock and earlier project stages do not unlock', () => {
  const unlocked = evaluateProposalVideoEntry({
    lockedDesign: false,
    projectStage: 'proposal',
    fileUrl: '',
    workflow: { stage: 'EXPORT_PDF' },
  });
  assert.equal(unlocked.allow, false);
  assert.match(unlocked.summary, /锁定设计/);
  assert.match(unlocked.summary, /已导出的 PDF 仍保留/);

  const narrative = evaluateProposalVideoEntry({
    lockedDesign: true,
    projectStage: 'pdp',
    fileUrl: '/api/pitchpro/projects/p1/proposal-pdf',
    workflow: { stage: 'EXPORT_PDF' },
  });
  assert.equal(narrative.allow, false);
  assert.match(narrative.summary, /叙事长图/);
  assert.equal(bumpReachedStep('pdp', narrative.unlockStep), 'pdp');

  const design = evaluateProposalVideoEntry({
    lockedDesign: false,
    projectStage: 'design',
  });
  assert.equal(design.allow, false);
  assert.doesNotMatch(design.summary, /可以进入场景视频/);
});

test('unlock stops at scene video and does not open the asset pack', () => {
  assert.equal(bumpReachedStep('proposal', true), 'video');
  assert.equal(bumpReachedStep('video', true), 'video');
  assert.equal(bumpReachedStep('assets', true), 'assets');
  assert.equal(bumpReachedStep('followup', false), 'followup');
});

test('a project already on scene video stays enterable after refresh', () => {
  const decision = evaluateProposalVideoEntry({
    lockedDesign: true,
    projectStage: 'video',
    fileUrl: '',
    workflow: { stage: 'EXPORT_PDF', missingData: ['Contact name/email'] },
  });
  assert.equal(decision.allow, true);
  assert.equal(bumpReachedStep('video', decision.unlockStep), 'video');
});
