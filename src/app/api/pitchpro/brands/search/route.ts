import * as pitch from '@/modules/pitchpro/service';
import { requireUser } from '@/modules/pitchpro/auth';
import { respData, respErr } from '@/lib/resp';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!user) return respErr('Unauthorized', { status: 401 });
    const body = await req.json().catch(() => ({}));

    if (body.url && typeof body.url === 'string') {
      const card = pitch.stubBrandFromUrl(body.url);
      return respData({
        items: [card],
        source: 'url-stub',
        notice: '根据粘贴链接生成的候选名片，请确认（演示解析，未实时抓取）',
      });
    }

    const cards = pitch.searchBrands({
      country: body.country,
      track: body.track,
      query: body.query,
    });
    return respData({
      items: cards,
      source: 'stub',
      notice: '检索结果，请确认（当前为演示轻搜索，可替换为真实网页检索）',
    });
  } catch (e: any) {
    return respErr(e.message || 'Search failed');
  }
}
