import { buildProposalContent, buildPdpCopy, resolveOnImageLanguage } from './pdp-copy';

export type DesignStubSeed = {
  title: string;
  direction: string;
  summary: string;
  imageUrl: string;
  palette: string[];
};

const IMAGE_POOL = [
  'https://images.unsplash.com/photo-1615634260167-c8cdede054de?w=600&h=600&fit=crop',
  'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=600&h=600&fit=crop',
  'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=600&h=600&fit=crop',
  'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&h=600&fit=crop',
  'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=600&fit=crop',
  'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=600&h=600&fit=crop',
];

/** Four concept directions derived from brief fields (stub, swap for real gen later). */
export function buildDesignStubs(input: {
  brandName: string;
  track: string;
  country: string;
  goals?: string;
  designDirection?: string;
  constraints?: string;
}): DesignStubSeed[] {
  const brand = input.brandName || '目标品牌';
  const track = input.track || '新品类';
  const hint = input.designDirection || input.goals || '贴合品牌调性的共创方向';
  const constraint = input.constraints
    ? `约束：${input.constraints}`
    : '结构/配方待工厂确认';

  const directions = [
    {
      title: `${brand} · 仪式感主视觉`,
      direction: '仪式感',
      summary: `围绕「${hint}」做居家场景主视觉，突出${track}的开箱与使用仪式。${constraint}`,
      palette: ['#F5E6D3', '#2C2C2C', '#C4A484'],
    },
    {
      title: `${brand} · 极简货架面`,
      direction: '极简货架',
      summary: `电商货架友好构图，留白与品牌色块清晰，适合${input.country || '目标市场'}线上主图。${constraint}`,
      palette: ['#FAFAFA', '#111111', '#8B7355'],
    },
    {
      title: `${brand} · 材质特写`,
      direction: '材质特写',
      summary: `强调材料与工艺可信度，特写纹理与手感，服务提案 PDF 内页。${constraint}`,
      palette: ['#E8DCC8', '#5C4033', '#D4C4A8'],
    },
    {
      title: `${brand} · 生活方式叙事`,
      direction: '生活方式',
      summary: `人物/场景叙事图，服务详情页与短视频封面，延续${track}赛道情绪。${constraint}`,
      palette: ['#DDE5EC', '#3D4F5F', '#F0E6DC'],
    },
  ];

  return directions.map((d, i) => ({
    ...d,
    imageUrl: IMAGE_POOL[i % IMAGE_POOL.length],
  }));
}

export type DeliverableKind =
  | 'concepts'
  | 'proposal'
  | 'pdp'
  | 'video'
  | 'outreach';


/** Market-language outreach email for follow-up / ZIP / GHL note. */
export function buildOutreachEmail(input: {
  brandName: string;
  country: string;
  track: string;
  designTitle: string;
  designDirection: string;
  goals?: string;
  audience?: string;
}): { subject: string; body: string; languageName: string; markdown: string } {
  const brand = input.brandName || 'Brand';
  const track = input.track || 'new category';
  const design = input.designTitle || 'co-creation concept';
  const direction = input.designDirection || '';
  const lang = resolveOnImageLanguage(input.country);
  const audience = (input.audience || '').trim();
  const goals = (input.goals || '').trim();

  if (!lang.forbidChinese && lang.languageName.includes('Chinese')) {
    const subject = `共创提案｜${brand} · ${track}`;
    const body = [
      `尊敬的 ${brand} 团队，您好：`,
      '',
      `我们基于贵司品牌调性，准备了「${design}」共创方向${direction ? `（${direction}）` : ''}，希望为品牌拓展新品类增长。`,
      audience ? `目标人群参考：${audience}` : '',
      goals ? `共创目标：${goals}` : '',
      '',
      '附件／素材包通常包含：锁定概念图、叙事长图、产品提案 PDF、场景短视频（若已生成）。',
      '',
      '若方向合适，期待您的反馈或安排一次短会；我们可继续对齐打样、报价与交期。',
      '',
      '此致',
      '呈品 PitchPro',
    ]
      .filter((l) => l !== '')
      .join('\n');
    const markdown = `主题：${subject}\n\n${body}`;
    return { subject, body, languageName: lang.languageName, markdown };
  }

  // Default B2B English for English markets; other markets use English with market note
  const marketNote =
    lang.languageName !== 'English'
      ? ` (market language preference: ${lang.languageName}; English used for B2B outreach)`
      : '';
  const subject = `Partnership idea for ${brand} — new ${track}`;
  const body = [
    `Hi ${brand} team,`,
    '',
    `We prepared a co-creation concept「${design}」aligned with your brand direction${direction ? ` (${direction})` : ''}${marketNote}.`,
    audience ? `Audience focus: ${audience}` : '',
    goals ? `Goal: ${goals}` : '',
    '',
    'The pack typically includes: locked concept visuals, narrative long image, product proposal PDF, and a short lifestyle video when ready.',
    '',
    'Would love your feedback or a brief call to align on sampling, pricing, and lead time.',
    '',
    'Best regards,',
    'PitchPro',
  ]
    .filter((l) => l !== '')
    .join('\n');
  const markdown = `Subject: ${subject}\n\n${body}`;
  return { subject, body, languageName: lang.languageName, markdown };
}

export function buildDeliverablePack(input: {
  brandName: string;
  track: string;
  country: string;
  designTitle: string;
  designDirection: string;
  designSummary: string;
  goals?: string;
  audience?: string;
  opportunity?: string;
  constraints?: string;
  /** From enterprise library uploads */
  factoryMaterialsNote?: string;
}): {
  kind: DeliverableKind;
  title: string;
  summary: string;
  content: string;
  fileUrl: string;
}[] {
  const brand = input.brandName || '品牌';
  const design = input.designTitle;
  const lineage = `同源视觉：${design}（${input.designDirection}）`;
  const pdp = buildPdpCopy({
    brandName: brand,
    track: input.track,
    country: input.country,
    designTitle: design,
    designDirection: input.designDirection,
    designSummary: input.designSummary,
    goals: input.goals,
    audience: input.audience,
  });

  return [
    {
      kind: 'concepts',
      title: '锁定概念图包',
      summary: lineage,
      content: `包含主视觉 1 张 + 辅图占位。\n方向：${input.designDirection}\n说明：${input.designSummary}\n\n（演示占位，可替换为真实出图）`,
      fileUrl: '',
    },
    {
      kind: 'proposal',
      title: `${brand} 产品提案`,
      summary: `品牌世界 · 概念 · 工厂交付（${input.track || '赛道'}）`,
      content: buildProposalContent({
        brandName: brand,
        track: input.track,
        country: input.country,
        designTitle: design,
        designDirection: input.designDirection,
        designSummary: input.designSummary,
        goals: input.goals,
        audience: input.audience,
        opportunity: input.opportunity,
        constraints: input.constraints,
        delivery: input.factoryMaterialsNote
          ? { factoryMaterialsNote: input.factoryMaterialsNote }
          : undefined,
      }),
      fileUrl: '',
    },
    {
      kind: 'pdp',
      title: pdp.title,
      summary: pdp.summary,
      content: pdp.content,
      fileUrl: '',
    },
    {
      kind: 'video',
      title: '生活方式短视频（横版）',
      summary: '10s · 16:9 · 720p · 锁定概念图作参考 · 左聊确认后生成',
      content: [
        `# Video brief — ${brand}`,
        '',
        `- Market: ${input.country || '—'}`,
        `- Track: ${input.track || '—'}`,
        `- Concept: ${design}`,
        `- Direction: ${input.designDirection || '—'}`,
        '',
        '## Shot plan (10s, 16:9)',
        '1. Cold open — product in lifestyle setting (1–2s)',
        '2. Hands / ritual use aligned with brand tone (3–4s)',
        '3. Hero product hold + soft brand close (2s)',
        '',
        '## Voice / on-screen copy',
        `One short claim matching ${input.track || 'the category'} and brand language for the market (no wrong-language overlays).`,
        '',
        '## Notes',
        '- Reference: locked concept image (+ selected narrative long image when available)',
        '- Confirm outline in left chat「呈品 · 视频」before generating',
      ].join('\n'),
      fileUrl: '',
    },
    {
      kind: 'outreach',
      title: '开发信（市场语种）',
      summary: '跟进用外发文案 · 可复制',
      content: buildOutreachEmail({
        brandName: brand,
        country: input.country,
        track: input.track,
        designTitle: design,
        designDirection: input.designDirection,
        goals: input.goals,
        audience: input.audience,
      }).markdown,
      fileUrl: '',
    },
  ];
}
