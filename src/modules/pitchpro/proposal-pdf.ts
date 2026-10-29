/**
 * Worker-friendly product-proposal PDF (pdf-lib).
 * Illustrated B2B booklet: brand world + concept + factory delivery; hero/long images interleaved via [[VISUAL:*]] markers.
 * Latin markets use Helvetica; CJK fetches a subset OTF once and caches it.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

import { resolveOnImageLanguage } from './pdp-copy';

const PAGE_W = 595; // A4
const PAGE_H = 842;
const MARGIN = 48;
const MAX_CONTENT_W = PAGE_W - MARGIN * 2;

type BuiltPdf = { bytes: Uint8Array; fileName: string };

export type ProposalPdfImage = {
  url: string;
  /** Caption under / above the image (market language optional). */
  label?: string;
  /** Prefer full-page fit for tall narrative long images. */
  role?: 'hero' | 'long';
};

const fontCache = new Map<string, Uint8Array>();

function needsCjkFont(languageName: string) {
  return (
    languageName.startsWith('Chinese') ||
    languageName === 'Japanese' ||
    languageName === 'Korean'
  );
}

function fontUrlFor(languageName: string): string | null {
  if (languageName.startsWith('Chinese')) {
    return 'https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf';
  }
  if (languageName === 'Japanese') {
    return 'https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/SubsetOTF/JP/NotoSansJP-Regular.otf';
  }
  if (languageName === 'Korean') {
    return 'https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/SubsetOTF/KR/NotoSansKR-Regular.otf';
  }
  return null;
}

async function loadCjkFontBytes(languageName: string): Promise<Uint8Array | null> {
  const url = fontUrlFor(languageName);
  if (!url) return null;
  const cached = fontCache.get(url);
  if (cached) return cached;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength < 10_000) return null;
    fontCache.set(url, bytes);
    return bytes;
  } catch {
    return null;
  }
}

function wrapLines(font: PDFFont, text: string, size: number, maxW: number): string[] {
  const raw = text.replace(/\r/g, '');
  const paragraphs = raw.split('\n');
  const lines: string[] = [];
  for (const para of paragraphs) {
    if (!para) {
      lines.push('');
      continue;
    }
    const hasSpace = /\s/.test(para);
    if (!hasSpace) {
      let cur = '';
      for (const ch of para) {
        const trial = cur + ch;
        let w = 0;
        try {
          w = font.widthOfTextAtSize(trial, size);
        } catch {
          w = trial.length * size * 0.9;
        }
        if (w > maxW && cur) {
          lines.push(cur);
          cur = ch;
        } else {
          cur = trial;
        }
      }
      if (cur) lines.push(cur);
      continue;
    }
    const words = para.split(/(\s+)/);
    let cur = '';
    for (const word of words) {
      const trial = cur + word;
      let w = 0;
      try {
        w = font.widthOfTextAtSize(trial, size);
      } catch {
        w = trial.length * size * 0.5;
      }
      if (w > maxW && cur.trim()) {
        lines.push(cur.replace(/\s+$/, ''));
        cur = word.replace(/^\s+/, '');
      } else {
        cur = trial;
      }
    }
    if (cur) lines.push(cur.replace(/\s+$/, ''));
  }
  return lines;
}

function stripMdNoise(line: string): { text: string; size: number; bold: boolean } {
  const t = line.trimEnd();
  if (t.startsWith('# ')) return { text: t.slice(2).trim(), size: 20, bold: true };
  if (t.startsWith('## ')) return { text: t.slice(3).trim(), size: 14, bold: true };
  if (t.startsWith('### ')) return { text: t.slice(4).trim(), size: 12, bold: true };
  if (t.startsWith('> ')) return { text: t.slice(2).trim(), size: 10, bold: false };
  if (t.startsWith('- ') || t.startsWith('* '))
    return { text: '• ' + t.slice(2).trim(), size: 10, bold: false };
  if (/^\d+\.\s/.test(t)) return { text: t, size: 10, bold: false };
  if (t === '---') return { text: '', size: 10, bold: false };
  return { text: t.replace(/\*\*/g, ''), size: 10, bold: false };
}

async function embedRemoteImage(
  doc: PDFDocument,
  url: string
): Promise<PDFImage | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const imgRes = await fetch(url);
    if (!imgRes.ok) return null;
    const buf = new Uint8Array(await imgRes.arrayBuffer());
    const ct = (imgRes.headers.get('content-type') || '').toLowerCase();
    const lower = url.toLowerCase();
    if (ct.includes('png') || lower.includes('.png')) {
      return await doc.embedPng(buf);
    }
    return await doc.embedJpg(buf);
  } catch {
    return null;
  }
}

function bookletLabels(languageName: string) {
  if (languageName.startsWith('Chinese')) {
    return {
      subtitle: '产品提案 · 品牌世界 / 概念 / 工厂交付',
      visuals: '视觉册页',
      concept: '锁定概念图',
      longSelected: '叙事长图（已选）',
      longAlt: '叙事长图（备选）',
    };
  }
  if (languageName === 'Japanese') {
    return {
      subtitle: '製品提案 · ブランド世界 / コンセプト / 工場納品',
      visuals: 'ビジュアル',
      concept: 'ロック済みコンセプト',
      longSelected: 'ナラティブ長尺（選定）',
      longAlt: 'ナラティブ長尺（別案）',
    };
  }
  if (languageName === 'Korean') {
    return {
      subtitle: '제품 제안서 · 브랜드 세계 / 컨셉 / 공장 납품',
      visuals: '비주얼',
      concept: '확정 컨셉 이미지',
      longSelected: '내러티브 롱이미지（선택）',
      longAlt: '내러티브 롱이미지（대안）',
    };
  }
  return {
    subtitle: 'Product Proposal · Brand world / Concept / Factory delivery',
    visuals: 'Visual booklet',
    concept: 'Locked concept visual',
    longSelected: 'Lifestyle narrative long image (selected)',
    longAlt: 'Lifestyle narrative long image (variant)',
  };
}

export async function buildProposalPdf(input: {
  brandName: string;
  country: string;
  markdown: string;
  /** @deprecated prefer images[]; still supported as cover hero */
  heroImageUrl?: string;
  /** Illustrated booklet visuals: concept + PDP long images */
  images?: ProposalPdfImage[];
}): Promise<BuiltPdf> {
  const lang = resolveOnImageLanguage(input.country);
  const labels = bookletLabels(lang.languageName);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  let font: PDFFont = await doc.embedFont(StandardFonts.Helvetica);
  let fontBold: PDFFont = await doc.embedFont(StandardFonts.HelveticaBold);
  if (needsCjkFont(lang.languageName)) {
    const bytes = await loadCjkFontBytes(lang.languageName);
    if (bytes) {
      font = await doc.embedFont(bytes, { subset: true });
      fontBold = font;
    }
  }

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const ensureSpace = (need: number) => {
    if (y - need < MARGIN) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  const drawTextBlock = (raw: string, size: number, useBold: boolean) => {
    const f = useBold ? fontBold : font;
    const lines = wrapLines(f, raw, size, MAX_CONTENT_W);
    for (const line of lines) {
      ensureSpace(size + 6);
      if (line) {
        try {
          page.drawText(line, {
            x: MARGIN,
            y: y - size,
            size,
            font: f,
            color: rgb(0.12, 0.12, 0.14),
            maxWidth: MAX_CONTENT_W,
          });
        } catch {
          /* skip unencodable glyphs */
        }
      }
      y -= size + 5;
    }
  };

  const drawFittedImage = (
    img: PDFImage,
    maxW: number,
    maxH: number,
    onPage: PDFPage
  ) => {
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    const w = img.width * scale;
    const h = img.height * scale;
    onPage.drawImage(img, {
      x: MARGIN + (maxW - w) / 2,
      y: y - h,
      width: w,
      height: h,
    });
    y -= h + 12;
  };

  // Cover header
  drawTextBlock(input.brandName || 'Brand', 22, true);
  y -= 4;
  drawTextBlock(labels.subtitle, 11, false);
  y -= 10;

  const imageList: ProposalPdfImage[] = [];
  if (input.images?.length) {
    for (const im of input.images) {
      if (im?.url) imageList.push(im);
    }
  } else if (input.heroImageUrl) {
    imageList.push({ url: input.heroImageUrl, label: labels.concept, role: 'hero' });
  }

  const heroImgMeta =
    imageList.find((im) => im.role === 'hero') || imageList[0] || null;
  const longImgMeta =
    imageList.find((im) => im.role === 'long') ||
    imageList.find((im) => im !== heroImgMeta) ||
    null;
  const usedUrls = new Set<string>();

  let heroEmbedded: PDFImage | null = null;
  let longEmbedded: PDFImage | null = null;
  if (heroImgMeta) {
    heroEmbedded = await embedRemoteImage(doc, heroImgMeta.url);
  }
  if (longImgMeta) {
    longEmbedded = await embedRemoteImage(doc, longImgMeta.url);
  }

  const drawVisual = async (
    kind: 'hero' | 'long',
    captionFallback: string
  ) => {
    const meta = kind === 'hero' ? heroImgMeta : longImgMeta;
    let img = kind === 'hero' ? heroEmbedded : longEmbedded;
    if (!meta || !img) return;
    usedUrls.add(meta.url);
    const caption = meta.label || captionFallback;
    // Long images get a dedicated page for brochure feel
    if (kind === 'long') {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
      drawTextBlock(caption, 12, true);
      y -= 6;
      const maxH = PAGE_H - MARGIN * 2 - 36;
      drawFittedImage(img, MAX_CONTENT_W, maxH, page);
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
      return;
    }
    drawTextBlock(caption, 10, true);
    y -= 2;
    ensureSpace(210);
    drawFittedImage(img, MAX_CONTENT_W, 220, page);
    y -= 4;
  };

  const md = (input.markdown || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/<<<[\s\S]*?>>>/g, '')
    .trim();

  for (const rawLine of md.split('\n')) {
    const trimmed = rawLine.trim();
    if (trimmed === '[[VISUAL:hero]]') {
      await drawVisual('hero', labels.concept);
      continue;
    }
    if (trimmed === '[[VISUAL:long]]') {
      await drawVisual('long', labels.longSelected);
      continue;
    }
    const { text, size, bold } = stripMdNoise(rawLine);
    if (!text && rawLine.trim() === '') {
      y -= 6;
      continue;
    }
    if (!text) continue;
    // Section headers: breathe + soft rule
    if (bold && size >= 14) {
      ensureSpace(size + 28);
      y -= 6;
      try {
        page.drawLine({
          start: { x: MARGIN, y: y + 4 },
          end: { x: MARGIN + MAX_CONTENT_W, y: y + 4 },
          thickness: 0.4,
          color: rgb(0.82, 0.82, 0.84),
        });
      } catch {
        /* ignore */
      }
      y -= 8;
    }
    drawTextBlock(text, size, bold);
    if (bold && size >= 14) y -= 4;
  }

  // Any unused booklet visuals (extra long variants) as trailing pages
  const rest = imageList.filter((im) => im.url && !usedUrls.has(im.url));
  if (rest.length) {
    for (const item of rest) {
      const img = await embedRemoteImage(doc, item.url);
      if (!img) continue;
      const caption = item.label || labels.longAlt;
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
      drawTextBlock(caption, 12, true);
      y -= 6;
      const maxH = PAGE_H - MARGIN * 2 - 28;
      drawFittedImage(img, MAX_CONTENT_W, maxH, page);
    }
  }

  const bytes = await doc.save();
  const safeBrand = (input.brandName || 'proposal')
    .replace(/[^\w.\u4e00-\u9fff-]+/g, '_')
    .slice(0, 40);
  return {
    bytes,
    fileName: `${safeBrand}-product-proposal.pdf`,
  };
}
