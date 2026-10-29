export type BrandSearchCard = {
  id: string;
  name: string;
  country: string;
  track: string;
  tone: string;
  imageUrl: string;
  website: string;
  instagram: string;
  facebook: string;
  matchReason: string;
  /** Always true for stub / live light-search — UI must show confirm badge */
  needsConfirm: true;
};

const CATALOG: Omit<BrandSearchCard, 'id' | 'needsConfirm' | 'matchReason'>[] = [
  {
    name: 'Aura Home',
    country: '美国',
    track: '生活方式香氛',
    tone: '温暖极简、居家仪式感，主打天然精油扩香',
    imageUrl: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=400&h=300&fit=crop',
    website: 'https://example.com/aura-home',
    instagram: 'https://instagram.com/aurahome',
    facebook: 'https://facebook.com/aurahome',
  },
  {
    name: 'Solstice Scent',
    country: '美国',
    track: '生活方式香氛',
    tone: '西海岸阳光、可持续包装、订阅制香氛',
    imageUrl: 'https://images.unsplash.com/photo-1615634260167-c8cdede054de?w=400&h=300&fit=crop',
    website: 'https://example.com/solstice-scent',
    instagram: 'https://instagram.com/solsticescent',
    facebook: '',
  },
  {
    name: 'Hearth & Wick',
    country: '美国',
    track: '生活方式香氛',
    tone: '手工蜡烛、季节限定、礼品套装导向',
    imageUrl: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=400&h=300&fit=crop',
    website: 'https://example.com/hearth-wick',
    instagram: 'https://instagram.com/hearthwick',
    facebook: 'https://facebook.com/hearthwick',
  },
  {
    name: 'Nordic Glow',
    country: '北欧',
    track: '护肤',
    tone: '干净配方、冷冽美学、敏肌友好',
    imageUrl: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&h=300&fit=crop',
    website: 'https://example.com/nordic-glow',
    instagram: 'https://instagram.com/nordicglow',
    facebook: '',
  },
  {
    name: 'Fjäll Skin',
    country: '北欧',
    track: '护肤',
    tone: '山地植物活性、户外护肤、功能向包装',
    imageUrl: 'https://images.unsplash.com/photo-1570194065650-d99fb4b38b17?w=400&h=300&fit=crop',
    website: 'https://example.com/fjall-skin',
    instagram: 'https://instagram.com/fjallskin',
    facebook: 'https://facebook.com/fjallskin',
  },
  {
    name: 'PetJoy Co.',
    country: '美国',
    track: '宠物用品',
    tone: '年轻养宠家庭、设计感狗窝与出行配件',
    imageUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=300&fit=crop',
    website: 'https://example.com/petjoy',
    instagram: 'https://instagram.com/petjoyco',
    facebook: 'https://facebook.com/petjoyco',
  },
  {
    name: 'BrewLab',
    country: '英国',
    track: '咖啡器具',
    tone: '精品咖啡器材、实验室美学、教学内容驱动',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop',
    website: 'https://example.com/brewlab',
    instagram: 'https://instagram.com/brewlabuk',
    facebook: '',
  },
  {
    name: 'Lumen Kids',
    country: '德国',
    track: '儿童家居',
    tone: '安全认证、北欧风儿童房、可持续材质',
    imageUrl: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=400&h=300&fit=crop',
    website: 'https://example.com/lumen-kids',
    instagram: 'https://instagram.com/lumenkids',
    facebook: 'https://facebook.com/lumenkids',
  },
];

function slugId(name: string, country: string, track: string) {
  return `stub-${Buffer.from(`${name}|${country}|${track}`).toString('base64url').slice(0, 24)}`;
}

/**
 * Lightweight stub search — structure matches future live web-search cards.
 * Filters by country / track / free-text query when provided.
 */
export function stubSearchBrands(input: {
  country?: string;
  track?: string;
  query?: string;
}): BrandSearchCard[] {
  const country = (input.country || '').trim();
  const track = (input.track || '').trim();
  const query = (input.query || '').trim().toLowerCase();

  let rows = CATALOG.filter((b) => {
    if (country && !b.country.includes(country) && !country.includes(b.country)) {
      // soft match: allow "美国" in "美国西海岸" style queries
      if (!`${country}`.includes(b.country) && !b.country.includes(country.split(/[\s,，]/)[0] || '')) {
        // if country provided and no overlap, still keep if query text matches later
        if (!query) return false;
      }
    }
    if (track && !b.track.includes(track) && !track.includes(b.track)) {
      if (!query) return false;
    }
    return true;
  });

  if (query) {
    rows = rows.filter((b) => {
      const hay = `${b.name} ${b.country} ${b.track} ${b.tone}`.toLowerCase();
      return (
        hay.includes(query) ||
        query.split(/\s+/).some((w) => w && hay.includes(w))
      );
    });
  }

  // If filters wiped everything, return a few relevant defaults
  if (rows.length === 0) {
    rows = CATALOG.slice(0, 3);
  }

  return rows.slice(0, 6).map((b) => ({
    ...b,
    id: slugId(b.name, b.country, b.track),
    needsConfirm: true as const,
    matchReason: buildReason(b, country, track, query),
  }));
}

function buildReason(
  b: (typeof CATALOG)[number],
  country: string,
  track: string,
  query: string
) {
  const parts: string[] = [];
  if (country && b.country.includes(country.split(/[\s,，]/)[0] || country)) {
    parts.push(`市场：${b.country}`);
  }
  if (track && (b.track.includes(track) || track.includes(b.track))) {
    parts.push(`赛道：${b.track}`);
  }
  if (query) parts.push(`关键词匹配「${query.slice(0, 24)}」`);
  if (parts.length === 0) parts.push('公开网页轻检索候选（演示数据）');
  return parts.join(' · ');
}

const URL_RE = /https?:\/\/[^\s<>"')\]]+/i;

export function extractUrls(text: string): string[] {
  return text.match(new RegExp(URL_RE.source, 'gi')) || [];
}

/** Build a single brand card from a pasted site / IG / FB URL (stub scrape). */
export function stubBrandFromUrl(rawUrl: string): BrandSearchCard {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    url = new URL(`https://${rawUrl.trim()}`);
  }
  const host = url.hostname.replace(/^www\./, '');
  const path = url.pathname.replace(/\/+$/, '');
  let name = '';
  let website = '';
  let instagram = '';
  let facebook = '';
  let channel = '官网';

  if (host.includes('instagram.com')) {
    const handle = path.split('/').filter(Boolean)[0] || 'brand';
    name = handle.replace(/^@/, '');
    instagram = `https://instagram.com/${name}`;
    channel = 'Instagram';
  } else if (host.includes('facebook.com') || host.includes('fb.com')) {
    const handle = path.split('/').filter(Boolean)[0] || 'brand';
    name = handle;
    facebook = `https://facebook.com/${handle}`;
    channel = 'Facebook';
  } else {
    const base = host.split('.')[0] || host;
    name = base
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    website = `${url.protocol}//${url.host}${path || ''}`;
    channel = '官网';
  }

  // Prefer catalog match by name / domain
  const hit = CATALOG.find(
    (b) =>
      b.name.toLowerCase() === name.toLowerCase() ||
      b.website.includes(host) ||
      b.instagram.includes(host + path) ||
      (instagram && b.instagram.includes(name))
  );
  if (hit) {
    return {
      ...hit,
      id: slugId(hit.name, hit.country, hit.track),
      needsConfirm: true,
      matchReason: `来自粘贴链接（${channel}），已匹配演示名片，请确认`,
      website: website || hit.website,
      instagram: instagram || hit.instagram,
      facebook: facebook || hit.facebook,
    };
  }

  return {
    id: slugId(name, '未定', '未定赛道'),
    name: name || '未知品牌',
    country: '',
    track: '',
    tone: `根据粘贴的${channel}链接生成的候选名片（未抓取页面，请人工确认调性与赛道）`,
    imageUrl: '',
    website,
    instagram,
    facebook,
    matchReason: `粘贴链接：${url.toString().slice(0, 80)}`,
    needsConfirm: true,
  };
}
