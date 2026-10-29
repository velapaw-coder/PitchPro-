/**
 * PDP long-image narrative copy + structured payload.
 * Content embeds <<<PDP_JSON>>> and <<<PDP_LONG_IMAGES>>> (dual Seedream long images).
 */

export type PdpFeature = { title: string; desc: string };

export type PdpStructured = {
  headline: string;
  subheadline: string;
  features: PdpFeature[];
  materials: string;
  scenarios: string;
  specs: string;
  cta: string;
  designTitle: string;
  designDirection: string;
  brandName: string;
  track: string;
  country: string;
  /** Brand lifestyle world (where audience lives / plays / aspires) — optional, backward compatible */
  lifestyleWorld?: string;
  /** A/B scene picks grounded in brand lifestyle — optional */
  selectedScenes?: { A?: string; B?: string };
  /** Social relations & activities of the brand audience — optional */
  socialDynamics?: string;
  /** Who the audience aspires to become — optional */
  aspirationalIdentity?: string;
  /** How the OEM product merges into that life — optional */
  productRole?: string;
  /** Explicit target audience override — optional (falls back to brief.audience) */
  targetAudience?: string;
};


/**
 * Map project.country / market to the language painted ON the long image.
 * Left-chat narrative for the operator may stay Chinese; Seedream on-image copy must follow this.
 */
export function resolveOnImageLanguage(country: string): {
  localeHint: string;
  forbidChinese: boolean;
  languageName: string;
} {
  const c = (country || '').trim().toLowerCase();
  const raw = (country || '').trim();

  const isChina =
    /^(中国|china|cn|prc|内地|大陆)$/i.test(raw) ||
    /\b(china|cn|prc)\b/i.test(c) ||
    c.includes('中国');
  if (isChina) {
    return {
      localeHint: raw || '中国',
      forbidChinese: false,
      languageName: 'Chinese (Simplified)',
    };
  }

  // English markets
  if (
    /美国|usa|u\.s\.?a?\.?|united states|america|英國|英国|u\.k\.?|united kingdom|england|britain|australia|澳大利亚|澳洲|canada|加拿大|new zealand|新西兰|ireland|爱尔兰|singapore|新加坡|hong kong|香港|global|worldwide|国际|出海|欧美/.test(
      c
    ) ||
    /\b(us|usa|uk|au|ca|nz|sg|hk)\b/i.test(c)
  ) {
    return {
      localeHint: raw || 'US',
      forbidChinese: true,
      languageName: 'English',
    };
  }

  if (/日本|japan|\bjp\b|东京|tokyo/.test(c)) {
    return {
      localeHint: raw || '日本',
      forbidChinese: true,
      languageName: 'Japanese',
    };
  }
  if (/韩国|korea|south korea|\bkr\b|首尔|seoul/.test(c)) {
    return {
      localeHint: raw || '韩国',
      forbidChinese: true,
      languageName: 'Korean',
    };
  }
  if (/德国|germany|\bde\b|deutschland/.test(c)) {
    return {
      localeHint: raw || '德国',
      forbidChinese: true,
      languageName: 'German',
    };
  }
  if (/法国|france|\bfr\b/.test(c)) {
    return {
      localeHint: raw || '法国',
      forbidChinese: true,
      languageName: 'French',
    };
  }
  if (/西班牙|spain|\bes\b|mexico|墨西哥|latin|拉美/.test(c)) {
    return {
      localeHint: raw || 'Spain',
      forbidChinese: true,
      languageName: 'Spanish',
    };
  }
  if (/意大利|italy|\bit\b/.test(c)) {
    return {
      localeHint: raw || '意大利',
      forbidChinese: true,
      languageName: 'Italian',
    };
  }
  if (/葡萄牙|portugal|brazil|巴西|\bpt\b|\bbr\b/.test(c)) {
    return {
      localeHint: raw || 'Portugal',
      forbidChinese: true,
      languageName: 'Portuguese',
    };
  }
  if (/阿拉伯|saudi|uae|dubai|中东|qatar|kuwait/.test(c)) {
    return {
      localeHint: raw || 'Middle East',
      forbidChinese: true,
      languageName: 'Arabic',
    };
  }
  if (/泰国|thailand|\bth\b/.test(c)) {
    return {
      localeHint: raw || '泰国',
      forbidChinese: true,
      languageName: 'Thai',
    };
  }
  if (/越南|vietnam|\bvn\b/.test(c)) {
    return {
      localeHint: raw || '越南',
      forbidChinese: true,
      languageName: 'Vietnamese',
    };
  }
  if (/印尼|indonesia|\bid\b/.test(c)) {
    return {
      localeHint: raw || 'Indonesia',
      forbidChinese: true,
      languageName: 'Indonesian',
    };
  }
  if (/俄罗斯|russia|\bru\b/.test(c)) {
    return {
      localeHint: raw || '俄罗斯',
      forbidChinese: true,
      languageName: 'Russian',
    };
  }

  // Default: export / Western-leaning markets → English, never Chinese on canvas
  return {
    localeHint: raw || 'export market',
    forbidChinese: true,
    languageName: 'English',
  };
}


export function featuresForTrack(track: string): PdpFeature[] {
  const t = track || '';
  if (/香氛|蜡烛|香薰|fragrance|candle/i.test(t)) {
    return [
      { title: '舒适氛围', desc: '低刺激配方取向，日常居家可安心使用（待工厂确认）' },
      { title: '层次香调', desc: '前中后调清晰，开箱即有仪式感' },
      { title: '多场景', desc: '卧室、客厅、礼赠与订阅套装均可延展' },
    ];
  }
  if (/耳机|音频|audio|earbud|headphone/i.test(t)) {
    return [
      { title: '佩戴舒适', desc: '轻盈开放结构，运动与日常都可久戴' },
      { title: '清晰听感', desc: '人声与环境音平衡，开放聆听更自由' },
      { title: '多场景', desc: '跑步、通勤、居家办公一条产品线打通' },
    ];
  }
  if (/护肤|美妆|skin|beauty|cosmetic/i.test(t)) {
    return [
      { title: '肤感友好', desc: '质地与吸收节奏贴合日常护肤流程' },
      { title: '成分可信', desc: '主打成分与功效主张清晰（待工厂确认）' },
      { title: '使用场景', desc: '晨间 / 晚间 / 旅行装可延展 SKU' },
    ];
  }
  if (/宠物|pet/i.test(t)) {
    return [
      { title: '宠物友好', desc: '材质与结构按宠物使用安全设计（待确认）' },
      { title: '耐用易洁', desc: '日常打理成本低，复购理由清晰' },
      { title: '生活场景', desc: '居家陪伴与出行场景一并覆盖' },
    ];
  }
  return [
    { title: '核心体验', desc: `贴合「${t || '目标赛道'}」的第一感受与使用价值` },
    { title: '材质工艺', desc: '质地 / 工艺可信度（待工厂确认规格）' },
    { title: '使用场景', desc: '覆盖主力消费场景与延展场景' },
  ];
}

export function buildPdpStructured(input: {
  brandName: string;
  track: string;
  country: string;
  designTitle: string;
  designDirection: string;
  designSummary: string;
  goals?: string;
  audience?: string;
}): PdpStructured {
  const brand = input.brandName || '品牌';
  const track = input.track || '新品类';
  const features = featuresForTrack(track);
  const headline =
    input.designDirection?.trim() ||
    `${brand} · ${track}`.slice(0, 24) ||
    '新品主张';
  const subheadline =
    input.designSummary?.trim() ||
    `面向${input.audience || '目标客群'}的${track}共创方向`;

  return {
    headline,
    subheadline,
    features,
    materials: [
      `质地与外观延续锁定视觉「${input.designTitle}」。`,
      '材质 / 工艺 / 表面处理待工厂打样确认；提案阶段先锁定视觉语言与手感关键词。',
    ].join(''),
    scenarios: [
      input.goals?.trim()
        ? `共创目标：${input.goals.trim()}。`
        : '共创目标待补充。',
      input.audience?.trim()
        ? `主力客群：${input.audience.trim()}。`
        : '',
      `市场：${input.country || '未定'} · ${track}。`,
      '建议用生活场景图承接详情页下半屏，强化「进品牌货架后的样子」。',
    ]
      .filter(Boolean)
      .join(''),
    specs: '规格表占位：尺寸 / 容量 / 重量 / 包装 / 认证（打样后补齐）。',
    cta: `了解 ${brand} × 共创方案 · 预约打样沟通`,
    designTitle: input.designTitle,
    designDirection: input.designDirection,
    brandName: brand,
    track,
    country: input.country || '未定',
  };
}

export function serializePdpContent(s: PdpStructured): string {
  const json = JSON.stringify(s);
  const md = [
    `# ${s.brandName} · 详情长图叙事稿`,
    '',
    `> ${s.headline}`,
    `> ${s.subheadline}`,
    '',
    '## 首屏主视觉',
    `引用锁定概念：${s.designTitle}（${s.designDirection}）`,
    '',
    '## 卖点三板斧',
    ...s.features.map((f, i) => `${i + 1}. **${f.title}** — ${f.desc}`),
    '',
    '## 材质 / 质地',
    s.materials,
    '',
    '## 消费场景',
    s.scenarios,
    '',
    '## 规格表（待填）',
    s.specs,
    '',
    '## CTA',
    s.cta,
    '',
    '## 市场',
    `${s.country} · ${s.track}`,
    '',
    '---',
    '确认长图后，将同源生成提案 / 视频占位 / 开发信等素材包。',
  ].join('\n');

  return `<<<PDP_JSON\n${json}\nPDP_JSON>>>\n\n${md}`;
}

export function parsePdpStructured(content: string | null | undefined): PdpStructured | null {
  if (!content) return null;
  const m = content.match(/<<<PDP_JSON\s*([\s\S]*?)\s*PDP_JSON>>>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]) as PdpStructured;
  } catch {
    return null;
  }
}

export function buildPdpCopy(input: {
  brandName: string;
  track: string;
  country: string;
  designTitle: string;
  designDirection: string;
  designSummary: string;
  goals?: string;
  audience?: string;
}): { title: string; summary: string; content: string } {
  const s = buildPdpStructured(input);
  return {
    title: `${s.brandName} · 详情长图`,
    summary: `基于锁定视觉「${s.designTitle}」的详情长图叙事结构（供 Seedream 排版）`,
    content: serializePdpContent(s),
  };
}



/** Opening lifestyle narrative for left-chat after lock (叙事师).
 * Text only: align brand-audience lifestyle world before Seedream long images.
 */
export function buildPdpNarrativeIntro(input: {
  brandName: string;
  track: string;
  country: string;
  designTitle: string;
  designDirection: string;
  designSummary: string;
  audience?: string;
  goals?: string;
}): string {
  const brand = input.brandName || '品牌';
  const track = input.track || '新品类';
  const audience = input.audience?.trim() || '目标客群（须对齐品牌真实人群，禁止套国家默认）';
  const goals = input.goals?.trim();
  const summary =
    input.designSummary?.trim() ||
    `视觉方向「${input.designDirection}」把品牌调性落到可触摸的产品语言。`;
  const lang = resolveOnImageLanguage(input.country);
  const culture = resolveMarketCulture(input.country);
  return [
    `我是「呈品 · 叙事师」。锁定视觉「${input.designTitle}」已定。`,
    '',
    '接下来只做一件事：用文字对齐——**即将生成的详情长图**讲什么（淘宝式竖版品牌详情长图）。',
    '场景必须来自**该品牌人群的真实生活、社交形式、兴趣活动与向往去处**，禁止用国家默认咖啡／厨房／客厅／办公室模板填充。',
    `市场：${input.country || '未定'} · 图上文案语种：${lang.languageName} · 人文区域：${culture.regionKey}（仅人物／语言／光线规范，不当场景模板）`,
    lang.forbidChinese
      ? '（HARD：非中国市场 — 图上可见文字禁止中文/汉字；左聊可用中文对齐。）'
      : '（中国市场：图上文案可用简体中文。）',
    '',
    `## 品牌世界（请对齐）`,
    `想象 ${audience} 在 ${brand} 的生活世界里遇见这款${track}。`,
    summary,
    `产品不是货架件，也不是「解决痛点」的戏剧道具：它融入 ${brand} 的调性、人群与向往生活，让人成为品牌所表达的那种人。`,
    ...(goals ? [`共创目标：${goals}。`] : []),
    '',
    '## 必须聊清（否则不要确认出图）',
    '1. **目标人群** — 年龄层／身份／审美偏好',
    '2. **向往身份** — 他们想成为什么样的人',
    '3. **品牌生活世界** — 真实去哪玩、在哪社交、向往目的地（旅行／户外／夜店／球场／工作室／市集…按品牌来）',
    '4. **本张场景候选 A／B** — 具体地点 + 活动意义 + 为何适配该品牌',
    '5. **社交关系与活动** — 独自／伴侣／朋友／社群；如何交流',
    '6. **产品如何融入** — 使用／穿戴／携带／展示／空间融合方式（须有真实功能依据）',
    '',
    '## 两张长图草案',
    '确认后系统生成 **两张** 竖版生活方式长图（共享产品外观／品牌色／人物关系；相机语言按品牌调性选定后系列锁定）：',
    '- **方案 A**：进入品牌人群向往的生活世界（社交／环境／品牌精神）；产品自然融入。',
    '- **方案 B**：延续 A 的世界；产品实际参与生活；积极收束。',
    '**禁止**国家默认咖啡／厨房／客厅／办公室固定模板；**禁止**痛点／冲突／解决方案戏剧。',
    '',
    '请在左侧改：品牌调性、人群、向往身份、生活世界、场景候选、社交形式、图上主张文案（目标市场语言）。',
    '**定稿后点「确认这版叙事」**——按品牌生活世界提示词 + 锁定产品图，Seedream 出两张长图供右侧对比。',
  ].join('\n');
}


/** Left-chat only: lifestyle / long-image story + locked hero. */
export function formatNarrativeChatMessage(opts: {
  brandName: string;
  designTitle: string;
  narrative: string;
  heroUrl?: string;
}): string {
  const hero = opts.heroUrl || '';
  return [
    opts.narrative.trim(),
    '',
    '---',
    '',
    hero
      ? `![锁定主视觉 · ${opts.designTitle}](${hero})`
      : '_（锁定主视觉待加载）_',
    '',
    `> 左侧对齐品牌生活世界叙事（人群／向往身份／去哪玩／社交形式／产品融入）· 满意后点「确认这版叙事」，右侧会出现两张长图（A 进入生活世界 / B 产品参与收束）供对比。禁止国家默认咖啡／厨房／客厅／办公室模板。`,
  ].join('\n');
}

/** Formal notice after long images are generated (optional chat body). */
export function formatPdpChatMessage(opts: {
  structured: PdpStructured;
  heroUrl?: string;
  narrative?: string;
  longImageUrl?: string;
  longImageUrls?: string[];
}): string {
  const s = opts.structured;
  const urls =
    opts.longImageUrls?.filter(Boolean) ||
    (opts.longImageUrl ? [opts.longImageUrl] : opts.heroUrl ? [opts.heroUrl] : []);
  const parts = [
    '已按确认的叙事生成详情长图（竖版大图，非网页）。',
    '',
    `品牌世界：${s.brandName} · ${s.headline}`,
    s.subheadline,
    '',
    ...urls.map(
      (u, i) => `![详情长图方案 ${i + 1}](${u})`
    ),
    '',
    '请到**右侧**对比两张长图，点选其一，再点「确认叙事长图，进入产品提案」。',
    '',
    `<<<PDP_JSON\n${JSON.stringify(s)}\nPDP_JSON>>>`,
  ];
  return parts.filter((p) => p !== '').join('\n');
}

/** Embed / parse dual long-image URLs inside deliverable content (no schema migration). */
export type PdpLongImages = { urls: string[]; selected: string };

export function parsePdpLongImages(
  content: string | null | undefined
): PdpLongImages | null {
  if (!content) return null;
  const m = content.match(
    /<<<PDP_LONG_IMAGES\s*([\s\S]*?)\s*PDP_LONG_IMAGES>>>/
  );
  if (!m) return null;
  try {
    const data = JSON.parse(m[1]) as PdpLongImages;
    if (!data || !Array.isArray(data.urls)) return null;
    return {
      urls: data.urls.filter((u) => typeof u === 'string' && !!u),
      selected: data.selected || data.urls[0] || '',
    };
  } catch {
    return null;
  }
}

export function embedPdpLongImages(
  content: string,
  urls: string[],
  selected?: string
): string {
  const cleaned = content
    .replace(/<<<PDP_LONG_IMAGES[\s\S]*?PDP_LONG_IMAGES>>>/g, '')
    .trim();
  const payload: PdpLongImages = {
    urls: urls.filter(Boolean),
    selected: selected || urls.find(Boolean) || '',
  };
  return `<<<PDP_LONG_IMAGES\n${JSON.stringify(payload)}\nPDP_LONG_IMAGES>>>\n\n${cleaned}`;
}

export function stripPdpLongImagesBlock(content: string): string {
  return content
    .replace(/<<<PDP_LONG_IMAGES[\s\S]*?PDP_LONG_IMAGES>>>/g, '')
    .trim();
}

/** Merge partial structured fields onto an existing PDP payload. */
export function mergePdpStructured(
  base: PdpStructured,
  patch: Partial<PdpStructured>
): PdpStructured {
  return {
    ...base,
    ...patch,
    features:
      patch.features && patch.features.length > 0
        ? patch.features
        : base.features,
    selectedScenes:
      patch.selectedScenes || base.selectedScenes
        ? {
            ...(base.selectedScenes || {}),
            ...(patch.selectedScenes || {}),
          }
        : undefined,
  };
}

/** B2B product proposal booklet — brand-buyer brochure (图文并茂). */
export type ProposalDeliveryFacts = {
  /** Factory / FOB / EXW price band (not retail). */
  priceBand?: string;
  /** Suggested retail / MSRP range for the brand buyer (soft; not a hard gate). */
  suggestedRetail?: string;
  moq?: string;
  leadTime?: string;
  sampleTimeline?: string;
  capacity?: string;
  packaging?: string;
  brandTone?: string;
  lifestyleAspiration?: string;
  /** Hook for enterprise-library uploads later */
  factoryMaterialsNote?: string;
};

const DELIVERY_FACT_KEYS = [
  'priceBand',
  'suggestedRetail',
  'moq',
  'leadTime',
  'sampleTimeline',
  'capacity',
  'packaging',
  'brandTone',
  'lifestyleAspiration',
  'factoryMaterialsNote',
] as const;

export type DeliveryFactKey = (typeof DELIVERY_FACT_KEYS)[number];

/** Explicit deferred markers allowed instead of a concrete number. */
export const DELIVERY_DEFERRED_MARKERS = [
  '本次暂无',
  '暂无',
  '暂缓',
  '本次暂缓',
  'deferred',
  'n/a-deferred',
] as const;

export function isDeliveryDeferred(value?: string | null): boolean {
  const v = (value || '').trim().toLowerCase();
  if (!v) return false;
  return (DELIVERY_DEFERRED_MARKERS as readonly string[]).some(
    (m) => v === m.toLowerCase()
  );
}

/** True when field has a real value or an explicit 本次暂无-style flag. */
export function isDeliveryFactSatisfied(value?: string | null): boolean {
  const v = (value || '').trim();
  if (!v || v === '...' || v === '…') return false;
  if (isDeliveryDeferred(v)) return true;
  const lower = v.toLowerCase();
  if (lower === 'tbd' || lower === 'n/a' || v === '待补充' || v === '未定' || v === '待共创确认') {
    return false;
  }
  return true;
}

export type DeliveryGateKey = 'priceBand' | 'moq' | 'leadTime';

/** Hard gate before leaving 聊方案 / confirming brief. */
export function assertDeliveryGate(facts: ProposalDeliveryFacts): {
  ok: boolean;
  missing: DeliveryGateKey[];
  message?: string;
} {
  const required: DeliveryGateKey[] = ['priceBand', 'moq', 'leadTime'];
  const missing = required.filter((k) => !isDeliveryFactSatisfied(facts[k]));
  if (!missing.length) return { ok: true, missing: [] };
  const labels: Record<DeliveryGateKey, string> = {
    priceBand: '出厂价/价格带 priceBand',
    moq: '起订量 MOQ',
    leadTime: '大货交期 leadTime',
  };
  const list = missing.map((k) => labels[k]).join('、');
  return {
    ok: false,
    missing,
    message: `请先补齐工厂交付硬信息再确认简报：${list}。可在对话里说明具体数字，或对某一项明确说「本次暂无」（写入 BRIEF 对应字段）。`,
  };
}

/** Parse factory/brand delivery fields stored inside brief.constraints. */
export function parseDeliveryFacts(constraints?: string): ProposalDeliveryFacts {
  const out: ProposalDeliveryFacts = {};
  if (!constraints?.trim()) return out;
  for (const line of constraints.split('\n')) {
    const m = line.match(/^\s*([a-zA-Z]+)\s*[:：]\s*(.+?)\s*$/);
    if (!m) continue;
    const key = m[1] as DeliveryFactKey;
    const val = m[2].trim();
    if (!(DELIVERY_FACT_KEYS as readonly string[]).includes(key)) continue;
    if (!val || val === '...' || val === '…') continue;
    out[key] = val;
  }
  return out;
}

/** Merge named delivery facts into constraints (keeps freeform notes). */
export function mergeDeliveryIntoConstraints(
  existing: string | undefined,
  delivery: ProposalDeliveryFacts
): string {
  const prev = parseDeliveryFacts(existing);
  const merged: ProposalDeliveryFacts = { ...prev, ...delivery };
  const freeform = (existing || '')
    .split('\n')
    .filter((line) => {
      const m = line.match(/^\s*([a-zA-Z]+)\s*[:：]/);
      if (!m) return line.trim().length > 0;
      return !(DELIVERY_FACT_KEYS as readonly string[]).includes(m[1]);
    })
    .join('\n')
    .trim();
  const lines: string[] = [];
  for (const key of DELIVERY_FACT_KEYS) {
    const v = merged[key]?.trim();
    if (v) lines.push(`${key}: ${v}`);
  }
  if (freeform) {
    if (lines.length) lines.push('');
    lines.push(freeform);
  }
  return lines.join('\n').trim();
}

type ProposalCopy = {
  titleSuffix: string;
  subtitle: string;
  pending: string;
  sectionCover: string;
  sectionBrandWorld: string;
  sectionConcept: string;
  sectionFit: string;
  sectionDelivery: string;
  sectionNext: string;
  coverClaimFallback: (brand: string, track: string) => string;
  brandToneLine: (tone: string) => string;
  audienceLine: (a: string) => string;
  lifestyleLine: (l: string) => string;
  goalsLine: (g: string) => string;
  marketLine: (c: string, t: string) => string;
  directionLine: (d: string) => string;
  summaryLine: (s: string) => string;
  conceptNote: string;
  fitDefault: (brand: string, track: string) => string;
  deliveryLabels: Record<
    | 'priceBand'
    | 'suggestedRetail'
    | 'moq'
    | 'leadTime'
    | 'sampleTimeline'
    | 'capacity'
    | 'packaging',
    string
  >;
  materialsHook: (note: string) => string;
  materialsHookEmpty: string;
  nextSteps: string[];
  footer: string;
  visualHero: string;
  visualLong: string;
  unsetMarket: string;
  unsetTrack: string;
  defaultAudience: (track: string) => string;
  defaultTone: string;
  defaultLifestyle: (track: string) => string;
};

const PROPOSAL_COPY_ZH: ProposalCopy = {
  titleSuffix: '产品提案',
  subtitle: '副标题：品牌世界 · 产品概念 · 工厂交付',
  pending: '待共创确认',
  sectionCover: '## 1. 封面主张',
  sectionBrandWorld: '## 2. 品牌世界（调性 · 人群 · 向往生活）',
  sectionConcept: '## 3. 产品概念与视觉方向',
  sectionFit: '## 4. 为何契合该品牌',
  sectionDelivery: '## 5. 工厂交付要点',
  sectionNext: '## 6. 下一步',
  coverClaimFallback: (brand, track) =>
    `${brand} × 工厂共创：把「${track || '新品类'}」做成看得见的品牌增长款`,
  brandToneLine: (t) => `- 品牌调性：${t}`,
  audienceLine: (a) => `- 目标人群：${a}`,
  lifestyleLine: (l) => `- 向往的生活方式：${l}`,
  goalsLine: (g) => `- 共创目标：${g}`,
  marketLine: (c, t) => `- 市场 / 赛道：${c} · ${t}`,
  directionLine: (d) => `- 视觉方向：${d}`,
  summaryLine: (s) => `- 概念说明：${s}`,
  conceptNote: '- 外观为概念示意；结构、配方与包材以工厂工程与打样为准',
  fitDefault: (brand, track) =>
    `本 SKU 按 ${brand} 的品牌世界设计：材质、仪式感与场景语言对齐目标人群，让买家「看见新品进自己品牌后的样子」，而不只是一张工厂产品图。赛道：${track || '新品类'}。`,
  deliveryLabels: {
    priceBand: '出厂价 / 价格带',
    suggestedRetail: '建议零售价',
    moq: '起订量 MOQ',
    leadTime: '大货交期',
    sampleTimeline: '打样周期',
    capacity: '产能参考',
    packaging: '包装 / 包材',
  },
  materialsHook: (n) => `- 工厂资料库引用：${n}`,
  materialsHookEmpty: '- 工厂资料库：可在企业资料库上传规格书 / 报价单后并入本册（结构已预留）',
  nextSteps: [
    '1. 确认本提案视觉与交付要点',
    '2. 打样：按确认外观与包材出样',
    '3. 报价：按出厂价带 / MOQ / 交期出正式报价；对照建议零售价看毛利空间',
    '4. 跟进：开发信 + 场景视频 / 出素材整包推进共创',
  ],
  footer: '（PDF 在左侧点「确认并生成 PDF」后生成；当前为可编辑大纲。图文标记 [[VISUAL:hero]] / [[VISUAL:long]] 会在 PDF 内嵌概念图与叙事长图。）',
  visualHero: '[[VISUAL:hero]]',
  visualLong: '[[VISUAL:long]]',
  unsetMarket: '未定',
  unsetTrack: '未定赛道',
  defaultAudience: (track) => `关注「${track || '新品类'}」的品牌目标消费人群`,
  defaultTone: '待共创确认（建议在聊方案补：极简 / 温暖 / 专业 / 户外等）',
  defaultLifestyle: (track) =>
    `与「${track || '新品类'}」匹配的日常仪式与品质生活场景（待共创确认具体画面）`,
};

const PROPOSAL_COPY_EN: ProposalCopy = {
  titleSuffix: 'Product Proposal',
  subtitle: 'Subtitle: Brand world · Concept · Factory delivery',
  pending: 'Pending co-creation',
  sectionCover: '## 1. Cover claim',
  sectionBrandWorld: '## 2. Brand world (tone · audience · aspired lifestyle)',
  sectionConcept: '## 3. Product concept & visual direction',
  sectionFit: '## 4. Why this SKU fits the brand',
  sectionDelivery: '## 5. Factory delivery facts',
  sectionNext: '## 6. Next steps',
  coverClaimFallback: (brand, track) =>
    `${brand} × factory co-creation: make “${track || 'new category'}” a visible growth SKU`,
  brandToneLine: (t) => `- Brand tone: ${t}`,
  audienceLine: (a) => `- Audience: ${a}`,
  lifestyleLine: (l) => `- Aspired lifestyle: ${l}`,
  goalsLine: (g) => `- Co-creation goals: ${g}`,
  marketLine: (c, t) => `- Market / category: ${c} · ${t}`,
  directionLine: (d) => `- Visual direction: ${d}`,
  summaryLine: (s) => `- Concept notes: ${s}`,
  conceptNote:
    '- Look is conceptual; structure, formula & packaging follow factory engineering / sampling',
  fitDefault: (brand, track) =>
    `This SKU is designed for ${brand}’s brand world: materials, ritual, and scene language match the audience so buyers “see the SKU in their brand,” not a generic factory shot. Category: ${track || 'new line'}.`,
  deliveryLabels: {
    priceBand: 'Factory / FOB price band',
    suggestedRetail: 'Suggested retail',
    moq: 'MOQ',
    leadTime: 'Bulk lead time',
    sampleTimeline: 'Sample timeline',
    capacity: 'Capacity',
    packaging: 'Packaging',
  },
  materialsHook: (n) => `- Factory library refs: ${n}`,
  materialsHookEmpty:
    '- Factory library: upload specs / quotes into enterprise library to fold into this booklet (hook ready)',
  nextSteps: [
    '1. Confirm visuals & delivery facts in this proposal',
    '2. Sampling: soft sample from locked look & packaging',
    '3. Quote: formal quote from factory price band / MOQ / lead time; use suggested retail for margin framing',
    '4. Follow-up: outreach + scene video / asset pack to advance co-creation',
  ],
  footer:
    '(PDF is created after “Confirm & generate PDF” on the left; this is an editable outline. Markers [[VISUAL:hero]] / [[VISUAL:long]] embed concept & narrative images in the PDF.)',
  visualHero: '[[VISUAL:hero]]',
  visualLong: '[[VISUAL:long]]',
  unsetMarket: 'TBD market',
  unsetTrack: 'TBD category',
  defaultAudience: (track) =>
    `Core consumers for “${track || 'new category'}”`,
  defaultTone: 'Pending co-creation (add in brief: minimal / warm / pro / outdoor…)',
  defaultLifestyle: (track) =>
    `Everyday rituals & quality-of-life scenes for “${track || 'new category'}” (pending concrete frames)`,
};

const PROPOSAL_COPY_JA: ProposalCopy = {
  titleSuffix: '製品提案',
  subtitle: 'サブタイトル：ブランド世界 · コンセプト · 工場納品',
  pending: '共創で確認予定',
  sectionCover: '## 1. カバー主張',
  sectionBrandWorld: '## 2. ブランド世界（トーン · 顧客 · 目指す暮らし）',
  sectionConcept: '## 3. 製品コンセプトとビジュアル',
  sectionFit: '## 4. なぜこのブランドに合うか',
  sectionDelivery: '## 5. 工場納品の要点',
  sectionNext: '## 6. 次のステップ',
  coverClaimFallback: (brand, track) =>
    `${brand} × 工場共創：「${track || '新カテゴリー'}」を見える成長SKUに`,
  brandToneLine: (t) => `- ブランドトーン：${t}`,
  audienceLine: (a) => `- 顧客：${a}`,
  lifestyleLine: (l) => `- 目指す暮らし：${l}`,
  goalsLine: (g) => `- 共創目標：${g}`,
  marketLine: (c, t) => `- 市場 / カテゴリー：${c} · ${t}`,
  directionLine: (d) => `- ビジュアル方向：${d}`,
  summaryLine: (s) => `- コンセプト説明：${s}`,
  conceptNote: '- 外観はコンセプト。構造・処方・包材は工場仕様と試作に準拠',
  fitDefault: (brand, track) =>
    `本SKUは ${brand} のブランド世界向け：素材・儀式・シーン言語を顧客に合わせ、「自社ブランドに入った姿」を見せます。カテゴリー：${track || '新ライン'}。`,
  deliveryLabels: {
    priceBand: '工場価格帯 / FOB',
    suggestedRetail: '推奨小売価格',
    moq: 'MOQ',
    leadTime: '量産納期',
    sampleTimeline: '試作リードタイム',
    capacity: '生産能力',
    packaging: '包装 / 包材',
  },
  materialsHook: (n) => `- 工場資料参照：${n}`,
  materialsHookEmpty: '- 工場資料庫：仕様書・見積をアップロード後に本冊へ統合予定（フック済み）',
  nextSteps: [
    '1. 本提案のビジュアルと納品要点を確認',
    '2. 試作：確定見た目・包材でサンプル',
    '3. 見積：価格帯 / MOQ / 納期で正式見積',
    '4. フォロー：アウトリーチ + シーン動画 / 素材パック',
  ],
  footer: '（左の確認ボタン後に PDF 生成。[[VISUAL:hero]] / [[VISUAL:long]] が PDF に画像を埋め込みます）',
  visualHero: '[[VISUAL:hero]]',
  visualLong: '[[VISUAL:long]]',
  unsetMarket: '未定',
  unsetTrack: '未定カテゴリー',
  defaultAudience: (track) => `「${track || '新カテゴリー'}」のコア層`,
  defaultTone: '共創で確認予定（ブリーフで補完）',
  defaultLifestyle: (track) =>
    `「${track || '新カテゴリー'}」に合う日常の儀式と暮らし（具体画は共創で確認）`,
};

const PROPOSAL_COPY_KO: ProposalCopy = {
  titleSuffix: '제품 제안서',
  subtitle: '부제: 브랜드 세계 · 컨셉 · 공장 납품',
  pending: '공동 제작 확인 예정',
  sectionCover: '## 1. 커버 주장',
  sectionBrandWorld: '## 2. 브랜드 세계 (톤 · 고객 · 지향 라이프)',
  sectionConcept: '## 3. 제품 컨셉과 비주얼',
  sectionFit: '## 4. 왜 이 브랜드에 맞는지',
  sectionDelivery: '## 5. 공장 납품 요점',
  sectionNext: '## 6. 다음 단계',
  coverClaimFallback: (brand, track) =>
    `${brand} × 공장 공동 제작: 「${track || '신카테고리'}」를 보이는 성장 SKU로`,
  brandToneLine: (t) => `- 브랜드 톤: ${t}`,
  audienceLine: (a) => `- 고객: ${a}`,
  lifestyleLine: (l) => `- 지향 라이프스타일: ${l}`,
  goalsLine: (g) => `- 공동 제작 목표: ${g}`,
  marketLine: (c, t) => `- 시장 / 카테고리: ${c} · ${t}`,
  directionLine: (d) => `- 비주얼 방향: ${d}`,
  summaryLine: (s) => `- 컨셉 설명: ${s}`,
  conceptNote: '- 외관은 컨셉; 구조·처방·포장은 공장 엔지니어링/샘플 기준',
  fitDefault: (brand, track) =>
    `이 SKU는 ${brand} 브랜드 세계에 맞춰 설계됩니다. 소재·의식·장면 언어가 고객과 맞아 “우리 브랜드에 들어온 모습”을 보여 줍니다. 카테고리: ${track || '신라인'}.`,
  deliveryLabels: {
    priceBand: '공장/FOB 가격대',
    suggestedRetail: '권장 소매가',
    moq: 'MOQ',
    leadTime: '양산 납기',
    sampleTimeline: '샘플 일정',
    capacity: '생산 능력',
    packaging: '포장',
  },
  materialsHook: (n) => `- 공장 자료 참조: ${n}`,
  materialsHookEmpty: '- 공장 자료실: 스펙/견적 업로드 후 본 제안에 통합 예정 (훅 준비됨)',
  nextSteps: [
    '1. 본 제안의 비주얼·납품 요점 확인',
    '2. 샘플: 확정 룩·포장으로 소프트 샘플',
    '3. 견적: 가격대 / MOQ / 납기로 정식 견적',
    '4. 팔로업: 아웃리치 + 장면 영상 / 소재 팩',
  ],
  footer: '(왼쪽 확인 후 PDF 생성. [[VISUAL:hero]] / [[VISUAL:long]] 가 PDF에 이미지를 넣습니다.)',
  visualHero: '[[VISUAL:hero]]',
  visualLong: '[[VISUAL:long]]',
  unsetMarket: '미정',
  unsetTrack: '미정 카테고리',
  defaultAudience: (track) => `「${track || '신카테고리'}」 핵심 소비층`,
  defaultTone: '공동 제작 확인 예정 (브리프에서 보완)',
  defaultLifestyle: (track) =>
    `「${track || '신카테고리'}」에 맞는 일상 의식과 라이프 (구체 화면은 공동 확인)`,
};

function proposalCopyForCountry(country: string): ProposalCopy {
  const lang = resolveOnImageLanguage(country).languageName;
  if (lang.startsWith('Chinese')) return PROPOSAL_COPY_ZH;
  if (lang === 'Japanese') return PROPOSAL_COPY_JA;
  if (lang === 'Korean') return PROPOSAL_COPY_KO;
  return PROPOSAL_COPY_EN;
}

function deliveryOrPending(copy: ProposalCopy, value?: string): string {
  const v = (value || '').trim();
  if (!v) return copy.pending;
  if (isDeliveryDeferred(v)) return v;
  const lower = v.toLowerCase();
  if (lower === 'tbd' || lower === 'n/a' || v === '待补充' || v === '未定') {
    return copy.pending;
  }
  return v;
}

/** True when outline still uses the old thin Who/Why/How template. */
export function isLegacyThinProposalOutline(md: string): boolean {
  if (!md?.trim()) return true;
  const hasDelivery =
    /工厂交付要点|Factory delivery facts|工場納品の要点|공장 납품 요점/.test(md);
  const hasOldHow =
    /开发逻辑（How）|Development logic \(How\)|開発ロジック（How）|개발 논리 \(How\)/.test(
      md
    );
  const hasBrandWorld =
    /品牌世界|Brand world|ブランド世界|브랜드 세계/.test(md);
  if (hasDelivery && hasBrandWorld) return false;
  if (hasOldHow && !hasDelivery) return true;
  return !hasDelivery;
}

export function buildProposalContent(input: {
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
  delivery?: ProposalDeliveryFacts;
}): string {
  const copy = proposalCopyForCountry(input.country);
  const brand =
    input.brandName || (copy === PROPOSAL_COPY_ZH ? '品牌' : 'Brand');
  const fromConstraints = parseDeliveryFacts(input.constraints);
  const delivery: ProposalDeliveryFacts = {
    ...fromConstraints,
    ...(input.delivery || {}),
  };
  const audience =
    input.audience?.trim() || copy.defaultAudience(input.track);
  const tone = deliveryOrPending(
    copy,
    delivery.brandTone || input.designDirection
  );
  const lifestyle = deliveryOrPending(
    copy,
    delivery.lifestyleAspiration || copy.defaultLifestyle(input.track)
  );
  const goals = deliveryOrPending(copy, input.goals);
  const market = input.country || copy.unsetMarket;
  const track = input.track || copy.unsetTrack;
  const cover =
    (input.designSummary || '').trim() ||
    copy.coverClaimFallback(brand, input.track);

  const deliveryLines = (
    [
      'priceBand',
      'suggestedRetail',
      'moq',
      'leadTime',
      'sampleTimeline',
      'capacity',
      'packaging',
    ] as const
  ).map((key) => {
    const label = copy.deliveryLabels[key];
    return `- ${label}：${deliveryOrPending(copy, delivery[key])}`;
  });

  const materialsLine = delivery.factoryMaterialsNote?.trim()
    ? copy.materialsHook(delivery.factoryMaterialsNote.trim())
    : copy.materialsHookEmpty;

  const opportunityLine = input.opportunity?.trim()
    ? `- ${copy === PROPOSAL_COPY_ZH ? '机会补充' : 'Opportunity note'}：${input.opportunity.trim()}`
    : '';

  return [
    `# ${brand} · ${copy.titleSuffix}`,
    copy.subtitle,
    '',
    copy.sectionCover,
    cover,
    '',
    copy.visualHero,
    '',
    copy.sectionBrandWorld,
    copy.brandToneLine(tone),
    copy.audienceLine(audience),
    copy.lifestyleLine(lifestyle),
    copy.goalsLine(goals),
    copy.marketLine(market, track),
    '',
    copy.visualLong,
    '',
    copy.sectionConcept,
    copy.directionLine(input.designDirection || copy.pending),
    copy.summaryLine(input.designSummary || copy.pending),
    copy === PROPOSAL_COPY_ZH
      ? `- 锁定概念：${input.designTitle || copy.pending}`
      : copy === PROPOSAL_COPY_JA
        ? `- ロック概念：${input.designTitle || copy.pending}`
        : copy === PROPOSAL_COPY_KO
          ? `- 확정 컨셉: ${input.designTitle || copy.pending}`
          : `- Locked concept: ${input.designTitle || copy.pending}`,
    copy.conceptNote,
    '',
    copy.sectionFit,
    copy.fitDefault(brand, track),
    ...(opportunityLine ? [opportunityLine] : []),
    '',
    copy.sectionDelivery,
    ...deliveryLines,
    materialsLine,
    '',
    copy.sectionNext,
    ...copy.nextSteps,
    '',
    '---',
    copy.footer,
  ].join('\n');

}

/**
 * Market culture cues for PEOPLE / LANGUAGE / LIGHT only.
 *
 * HARD: Do NOT use lifestyleSpaces / rituals from this function as scene templates
 * (no nation-default kitchen / coffee / living-room / home-office). Scene must come
 * from the brand lifestyle world confirmed in narrative / PDP_JSON.
 * Tied to project.country — never default to CN aesthetics for non-China markets.
 */
export function resolveMarketCulture(country: string): {
  regionKey: string;
  /**
   * Person & social-culture norms for the market.
   * NOT concrete shot locations — callers must NOT paste this as a scene list.
   */
  lifestyleSpaces: string;
  /**
   * Interpersonal / social-behavior register notes.
   * NOT default activity scenes (coffee/kitchen/sofa/office forbidden as nation templates).
   */
  rituals: string;
  /** Market-appropriate adult wardrobe culture (not forced homewear / athleisure) */
  wardrobeCue: string;
  lightCue: string;
  /** Sample on-screen / VO lines in market language (short) */
  sampleOnScreenLines: string[];
  forbidChinaAesthetics: boolean;
} {
  const lang = resolveOnImageLanguage(country);
  const c = (country || '').trim().toLowerCase();
  const raw = (country || '').trim();

  const peopleNorm = (regionLabel: string) =>
    `${regionLabel}：人物气质、社交距离与公共生活习惯贴合当地真实人口结构；场景地点禁止用国家默认咖啡／厨房／客厅／办公室模板 — 必须来自品牌生活世界`;
  const socialNorm =
    '社交行为：按品牌人群选择独处／伴侣／朋友／社群活动形式；禁止机械套用居家收纳或手冲咖啡国家默认仪式';

  const isChina = !lang.forbidChinese;
  if (isChina) {
    return {
      regionKey: 'cn',
      lifestyleSpaces: peopleNorm('中国市场人物与社交文化规范'),
      rituals: socialNorm,
      wardrobeCue: '符合品牌人群的当代成人着装（都市休闲／轻商务／运动户外／晚间社交等按品牌选择，禁止强行家居服默认）',
      lightCue: '符合中国城市气候与时段的自然光或室内光（按场景选择，不固定暖黄客厅灯）',
      sampleOnScreenLines: ['安心的日常', '为生活留白', '一起共创下一款'],
      forbidChinaAesthetics: false,
    };
  }

  if (/美国|usa|u\.s\.|united states|america|canada|加拿大|\bus\b|\bca\b/.test(c)) {
    return {
      regionKey: 'na',
      lifestyleSpaces: peopleNorm('US/NA person & social-culture norms'),
      rituals: socialNorm,
      wardrobeCue:
        'contemporary adult dress matching brand audience (outdoor, urban, travel, studio, evening — not forced athleisure or house slippers)',
      lightCue: 'natural light matching the chosen scene climate (US/CA); do not force suburban kitchen window light',
      sampleOnScreenLines: ['Made for real mornings', 'Feel at home', 'Your next everyday essential'],
      forbidChinaAesthetics: true,
    };
  }

  if (
    /英國|英国|u\.k|united kingdom|england|britain|australia|澳大利亚|澳洲|new zealand|新西兰|ireland|爱尔兰|singapore|新加坡|hong kong|香港|\buk\b|\bau\b|\bnz\b|\bsg\b|\bhk\b/.test(
      c
    )
  ) {
    return {
      regionKey: 'en-intl',
      lifestyleSpaces: peopleNorm('EN-intl person & social-culture norms'),
      rituals: socialNorm,
      wardrobeCue:
        'smart-casual or brand-fit contemporary adult dress (outdoor / city / travel / social — not forced indoor slippers)',
      lightCue: 'soft daylight matching the chosen scene climate; do not force overcast flat interiors',
      sampleOnScreenLines: ['Quietly better days', 'Designed for real life', 'From idea to everyday'],
      forbidChinaAesthetics: true,
    };
  }

  if (/日本|japan|\bjp\b|东京|tokyo/.test(c)) {
    return {
      regionKey: 'jp',
      lifestyleSpaces: peopleNorm('日本市場の人物・社交文化規範'),
      rituals: socialNorm,
      wardrobeCue: 'ブランド顧客に合う現代的な大人の装い（外出・旅行・仕事・社交など。室内着固定は禁止）',
      lightCue: '選択したシーンの気候に合う自然光／室内光（障子リビング固定は禁止）',
      sampleOnScreenLines: ['日常に、余白を', 'ていねいに暮らす', 'つぎの定番へ'],
      forbidChinaAesthetics: true,
    };
  }

  if (/韩国|korea|south korea|\bkr\b|首尔|seoul/.test(c)) {
    return {
      regionKey: 'kr',
      lifestyleSpaces: peopleNorm('한국 시장 인물·소셜 문화 규범'),
      rituals: socialNorm,
      wardrobeCue: '브랜드 오디언스에 맞는 현대적 성인 복장（외출/여행/소셜 등, 홈웨어 강제 금지）',
      lightCue: '선택한 장면 기후에 맞는 자연광/실내광（홈카페 고정 금지）',
      sampleOnScreenLines: ['일상에 스며들다', '편안한 루틴', '다음 스테디셀러'],
      forbidChinaAesthetics: true,
    };
  }

  if (/德国|germany|\bde\b|deutschland/.test(c)) {
    return {
      regionKey: 'de',
      lifestyleSpaces: peopleNorm('DE Personen- & Sozialkulturnormen'),
      rituals: socialNorm,
      wardrobeCue:
        'zeitgemäße Erwachsenenkleidung passend zur Marken-Zielgruppe (Outdoor/Stadt/Reise/Sozial — kein erzwungenes Hausoutfit)',
      lightCue: 'natürliches Licht passend zur gewählten Szene; kein erzwungenes Wohnküchenlicht',
      sampleOnScreenLines: ['Für den Alltag gemacht', 'Ruhig. Klar. Echt.', 'Nächster Alltagsheld'],
      forbidChinaAesthetics: true,
    };
  }

  if (/法国|france|\bfr\b/.test(c)) {
    return {
      regionKey: 'fr',
      lifestyleSpaces: peopleNorm('FR normes personnes & sociales'),
      rituals: socialNorm,
      wardrobeCue:
        'tenue adulte contemporaine selon l’audience de la marque (ville / voyage / social — pas de tenue d’intérieur forcée)',
      lightCue: 'lumière naturelle adaptée à la scène choisie; pas de forçage salon parisien',
      sampleOnScreenLines: ['Le quotidien, en mieux', 'Chez soi, simplement', 'La prochaine évidence'],
      forbidChinaAesthetics: true,
    };
  }

  if (/西班牙|spain|\bes\b|mexico|墨西哥|latin|拉美/.test(c)) {
    return {
      regionKey: 'es',
      lifestyleSpaces: peopleNorm('ES normas de personas y cultura social'),
      rituals: socialNorm,
      wardrobeCue:
        'vestimenta adulta contemporánea según la audiencia de la marca (ciudad / viaje / social — sin forzar ropa de casa)',
      lightCue: 'luz natural acorde a la escena elegida; no forzar salón / cocina',
      sampleOnScreenLines: ['Hecho para el día a día', 'Calma en casa', 'Tu próximo esencial'],
      forbidChinaAesthetics: true,
    };
  }

  if (/意大利|italy|\bit\b/.test(c)) {
    return {
      regionKey: 'it',
      lifestyleSpaces: peopleNorm('IT norme persone e cultura sociale'),
      rituals: socialNorm,
      wardrobeCue:
        'abbigliamento adulto contemporaneo secondo il pubblico del brand (città / viaggio / social — non forzare casa)',
      lightCue: 'luce naturale adatta alla scena scelta; non forzare cucina / soggiorno',
      sampleOnScreenLines: ['Per la vita di tutti i giorni', 'A casa, con calma', 'Il prossimo essenziale'],
      forbidChinaAesthetics: true,
    };
  }

  if (/葡萄牙|portugal|brazil|巴西|\bpt\b|\bbr\b/.test(c)) {
    return {
      regionKey: 'pt',
      lifestyleSpaces: peopleNorm('PT normas de pessoas e cultura social'),
      rituals: socialNorm,
      wardrobeCue:
        'roupa adulta contemporânea segundo a audiência da marca (cidade / viagem / social — sem forçar casa)',
      lightCue: 'luz natural adequada à cena escolhida; não forçar sala / cozinha',
      sampleOnScreenLines: ['Feito para o dia a dia', 'Calma em casa', 'Seu próximo essencial'],
      forbidChinaAesthetics: true,
    };
  }

  if (/阿拉伯|saudi|uae|dubai|中东|qatar|kuwait/.test(c)) {
    return {
      regionKey: 'ar',
      lifestyleSpaces: peopleNorm('Gulf / AR person & social-culture norms'),
      rituals: socialNorm,
      wardrobeCue:
        'modest contemporary adult dress matching brand audience (public / travel / social — not forced home attire)',
      lightCue: 'light matching the chosen scene climate; do not force villa living-room defaults',
      sampleOnScreenLines: ['لروتين يومي أفضل', 'راحة في المنزل', 'ضرورتك القادمة'],
      forbidChinaAesthetics: true,
    };
  }

  if (/泰国|thailand|\bth\b/.test(c)) {
    return {
      regionKey: 'th',
      lifestyleSpaces: peopleNorm('TH person & social-culture norms'),
      rituals: socialNorm,
      wardrobeCue: 'contemporary adult dress matching brand audience (city / travel / social — not forced homewear)',
      lightCue: 'light matching the chosen scene climate; do not force condo kitchen defaults',
      sampleOnScreenLines: ['เพื่อทุกวันของคุณ', 'พักผ่อนที่บ้าน', 'สิ่งจำเป็นชิ้นถัดไป'],
      forbidChinaAesthetics: true,
    };
  }

  if (/越南|vietnam|\bvn\b/.test(c)) {
    return {
      regionKey: 'vn',
      lifestyleSpaces: peopleNorm('VN person & social-culture norms'),
      rituals: socialNorm,
      wardrobeCue: 'contemporary adult dress matching brand audience (city / travel / social — not forced homewear)',
      lightCue: 'light matching the chosen scene climate; do not force apartment kitchen defaults',
      sampleOnScreenLines: ['Cho ngày thường của bạn', 'Thư thái tại nhà', 'Vật dụng tiếp theo'],
      forbidChinaAesthetics: true,
    };
  }

  if (/印尼|indonesia|\bid\b/.test(c)) {
    return {
      regionKey: 'id',
      lifestyleSpaces: peopleNorm('ID person & social-culture norms'),
      rituals: socialNorm,
      wardrobeCue: 'contemporary adult dress matching brand audience (city / travel / social — not forced homewear)',
      lightCue: 'light matching the chosen scene climate; do not force apartment kitchen defaults',
      sampleOnScreenLines: ['Untuk hari-hari biasa', 'Tenang di rumah', 'Kebutuhan berikutnya'],
      forbidChinaAesthetics: true,
    };
  }

  if (/俄罗斯|russia|\bru\b/.test(c)) {
    return {
      regionKey: 'ru',
      lifestyleSpaces: peopleNorm('RU person & social-culture norms'),
      rituals: socialNorm,
      wardrobeCue: 'contemporary adult dress matching brand audience (city / travel / social — not forced homewear)',
      lightCue: 'light matching the chosen scene climate; do not force apartment kitchen defaults',
      sampleOnScreenLines: ['Для обычных дней', 'Спокойствие дома', 'Ваш следующий must-have'],
      forbidChinaAesthetics: true,
    };
  }

  return {
    regionKey: 'export-en',
    lifestyleSpaces: peopleNorm(`export-market (${raw || 'global'}) person & social-culture norms`),
    rituals: socialNorm,
    wardrobeCue:
      'local-market contemporary adult dress matching brand audience — not forced home attire; NOT Chinese mainland fashion defaults',
    lightCue: 'soft natural light matching the chosen scene climate; do not force home kitchen/living defaults',
    sampleOnScreenLines: ['Made for everyday', 'Feel at home', 'Your next essential'],
    forbidChinaAesthetics: true,
  };
}

/** Pull a short labeled section from narrative markdown / chat text. */
function extractNarrativeSection(text: string, headerRe: RegExp): string {
  if (!text) return '';
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!headerRe.test(lines[i])) continue;
    const buf: string[] = [];
    const after = lines[i]
      .replace(/^[#*\-\s]*/, '')
      .replace(headerRe, '')
      .replace(/^[:：\s]+/, '')
      .trim();
    if (after && after.length > 4) buf.push(after);
    for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
      const l = lines[j].trim();
      if (!l) {
        if (buf.length) break;
        continue;
      }
      if (/^#{1,3}\s/.test(l)) break;
      if (
        /^(目标人群|向往身份|生活世界|品牌世界|社交|场景|方案\s*[AB]|产品融入|aspirational|lifestyle|social|selected\s*scene)/i.test(
          l
        ) &&
        !headerRe.test(l)
      ) {
        break;
      }
      buf.push(l.replace(/^[-*·•]\s*/, ''));
    }
    const joined = buf.join(' ').trim();
    if (joined.length > 8) return joined.slice(0, 420);
  }
  return '';
}

export type BrandLifestyleForPrompt = {
  targetAudience: string;
  aspirationalIdentity: string;
  brandLifestyleWorld: string;
  selectedSceneA: string;
  selectedSceneB: string;
  socialDynamics: string;
  productRole: string;
};

/**
 * Resolve brand-grounded lifestyle fields for Seedream / video prompts.
 * Priority: PDP_JSON structured → narrative labeled sections → design direction/summary.
 * NEVER falls back to nation-default coffee / kitchen / living-room / office templates.
 */
export function resolveBrandLifestyleForPrompt(input: {
  brandName: string;
  track: string;
  audience?: string;
  designDirection: string;
  designSummary: string;
  narrativeText: string;
  structured: PdpStructured | null;
}): BrandLifestyleForPrompt {
  const s = input.structured;
  const narrative = (input.narrativeText || '').trim();
  const pick = (...cands: Array<string | undefined | null>) => {
    for (const c of cands) {
      const t = (c || '').trim();
      if (t) return t;
    }
    return '';
  };

  const brand = input.brandName || '品牌';
  const track = input.track || '新品类';
  const direction = (input.designDirection || '').trim();
  const summary = (input.designSummary || '').trim();

  const targetAudience = pick(
    s?.targetAudience,
    input.audience,
    extractNarrativeSection(narrative, /目标人群|target\s*audience|人群画像|主力客群/i),
    `${brand} 目标消费者（须由叙事确认）`
  );

  const aspirationalIdentity = pick(
    s?.aspirationalIdentity,
    extractNarrativeSection(
      narrative,
      /向往身份|aspirational\s*identity|成为什么样的人|向往的人|身份向往/i
    ),
    '成为品牌所表达的那种人（须由叙事确认，勿套国家默认）'
  );

  const brandLifestyleWorld = pick(
    s?.lifestyleWorld,
    extractNarrativeSection(
      narrative,
      /品牌生活世界|生活世界|lifestyle\s*world|向往的?生活|品牌世界|去哪玩|向往目的地/i
    ),
    direction,
    summary,
    '须严格采用已确认的品牌生活世界；禁止国家默认咖啡／厨房／客厅／办公室模板'
  );

  const scenes = s?.selectedScenes;
  const selectedSceneA = pick(
    scenes && typeof scenes === 'object' ? scenes.A : undefined,
    extractNarrativeSection(
      narrative,
      /方案\s*A|场景\s*A|selected\s*scene\s*A|开场场景|理念开场场景/i
    ),
    s?.scenarios,
    `在「${brandLifestyleWorld}」中的品牌人群开场场景（具体地点与活动须来自叙事确认；禁止国家默认模板）`
  );
  const selectedSceneB = pick(
    scenes && typeof scenes === 'object' ? scenes.B : undefined,
    extractNarrativeSection(
      narrative,
      /方案\s*B|场景\s*B|selected\s*scene\s*B|使用场景|收束场景|仪式场景/i
    ),
    s?.scenarios,
    `延续同一品牌生活世界，产品实际参与生活的情境（须来自叙事确认；禁止国家默认模板）`
  );

  const socialDynamics = pick(
    s?.socialDynamics,
    extractNarrativeSection(
      narrative,
      /社交关系|社交活动|social\s*dynamics|一起|朋友|伴侣|社群|交流形式/i
    ),
    '品牌人群自然的社交关系与活动形式（须由叙事确认；禁止国家默认居家模板）'
  );

  const productRole = pick(
    s?.productRole,
    extractNarrativeSection(
      narrative,
      /产品融入|product\s*role|如何使用|使用方式|融合方式|携带|穿戴/i
    ),
    `制造商「${track}」作为 ${brand} 旗下新品，按真实功能自然融入上述生活世界（使用／穿戴／携带／展示／陈列）`
  );

  return {
    targetAudience,
    aspirationalIdentity,
    brandLifestyleWorld,
    selectedSceneA,
    selectedSceneB,
    socialDynamics,
    productRole,
  };
}
