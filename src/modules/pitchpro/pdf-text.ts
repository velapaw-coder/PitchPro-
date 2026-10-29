/**
 * Worker-safe PDF text extraction for enterprise uploads / chat attachments.
 * Primary: unpdf / PDF.js page-by-page (first N pages only — full-doc extract
 * OOMs/timeouts on typical 5–25MB factory brochures in CF Workers).
 * Fallback: rough literal / hex-string scrape on a capped byte window.
 * Scanned / image-only PDFs: no OCR — caller should surface a Chinese note.
 * Never throws to callers.
 */

export type PdfExtractResult = {
  text: string;
  pageCount: number;
  pagesExtracted: number;
  /** True when we got little/no real text (likely scan, encrypted, or parse fail). */
  likelyScannedOrEmpty: boolean;
  source: 'unpdf' | 'fallback' | 'none';
  /** Machine-readable failure / partial hint for Chinese notes. */
  reason:
    | 'ok'
    | 'partial'
    | 'empty'
    | 'parse_error'
    | 'too_large_partial';
};

const MIN_USEFUL_CHARS = 48;
/** Hard cap on characters kept for textPreview / chat excerpt. */
const MAX_TEXT_CHARS = 12000;
/** Never ask PDF.js for more than this many pages on Workers. */
const MAX_PAGES = 20;
/** Stop early once we have this much useful text. */
const EARLY_STOP_CHARS = 8000;
/** Fallback scrape only looks at the first N bytes (latin1). */
const FALLBACK_BYTE_CAP = 4 * 1024 * 1024;
/** Above this size we still extract, but mark as too_large_partial if truncated. */
const LARGE_PDF_BYTES = 6 * 1024 * 1024;

function toCleanUint8Array(buffer: Buffer | Uint8Array): Uint8Array {
  // ALWAYS copy bytes. pdf.js / unpdf may transfer+detach the underlying
  // ArrayBuffer; a view into the same buffer then throws
  // "Cannot perform Construct on a detached ArrayBuffer" on fallback.
  return Uint8Array.from(buffer as ArrayLike<number>);
}

function normalizeExtracted(raw: string): string {
  return (raw || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function usefulCharCount(text: string): number {
  const m = text.match(/[\u4e00-\u9fffA-Za-z0-9]/g);
  return m ? m.length : 0;
}

/** Reject binary garbage from compressed-stream scrapes. */
function looksLikeReadableText(text: string): boolean {
  if (!text) return false;
  const useful = usefulCharCount(text);
  if (useful < MIN_USEFUL_CHARS) return false;
  const printable = (text.match(/[\u4e00-\u9fffA-Za-z0-9\s.,;:/%$€£¥()\-_/]/g) || [])
    .length;
  return printable / Math.max(text.length, 1) >= 0.72;
}

function pageItemToString(item: unknown): string {
  if (!item || typeof item !== 'object') return '';
  const str = (item as { str?: unknown }).str;
  return typeof str === 'string' ? str : '';
}

/**
 * Extract text page-by-page via PDF.js proxy (unpdf getDocumentProxy).
 * Caps pages and early-stops to stay within Worker memory/CPU.
 */
async function extractViaUnpdfPages(
  data: Uint8Array
): Promise<{
  text: string;
  pageCount: number;
  pagesExtracted: number;
  truncated: boolean;
}> {
  const { getDocumentProxy } = await import('unpdf');
  // Defaults already lean (disableFontFace in Node); avoid extra options that
  // some Workers pdf.js builds reject.
  const pdf = await getDocumentProxy(data);

  const pageCount = Number(pdf.numPages) || 0;
  const limit = Math.min(pageCount, MAX_PAGES);
  const parts: string[] = [];
  let pagesExtracted = 0;

  for (let i = 1; i <= limit; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = (content?.items || []) as unknown[];
    const pageText = items
      .map(pageItemToString)
      .filter(Boolean)
      .join(' ');
    if (pageText.trim()) parts.push(pageText.trim());
    pagesExtracted = i;
    if (usefulCharCount(parts.join('\n')) >= EARLY_STOP_CHARS) break;
  }

  const text = normalizeExtracted(parts.join('\n\n'));
  const truncated =
    pageCount > pagesExtracted || text.length >= MAX_TEXT_CHARS;
  return {
    text: text.slice(0, MAX_TEXT_CHARS),
    pageCount,
    pagesExtracted,
    truncated,
  };
}

/** Rough scrape: PDF literal strings `(...)` and hex `<FEFF…>` (UTF-16BE). */
export function extractPdfTextFallback(buffer: Buffer | Uint8Array): string {
  const full = toCleanUint8Array(buffer);
  const capped =
    full.byteLength > FALLBACK_BYTE_CAP
      ? full.subarray(0, FALLBACK_BYTE_CAP)
      : full;
  const raw = Buffer.from(capped).toString('latin1');
  const bits: string[] = [];

  const parenRe = /\((?:\\.|[^\\)]){2,200}\)/g;
  let m: RegExpExecArray | null;
  while ((m = parenRe.exec(raw)) && bits.join('').length < 12000) {
    const s = m[0]
      .slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .replace(/\\t/g, ' ')
      .replace(/\\([()\\])/g, '$1')
      .replace(/\\\d{1,3}/g, ' ')
      .trim();
    if (s && /[\u4e00-\u9fffA-Za-z0-9]/.test(s) && looksLikeReadableText(s + ' xx')) {
      const ratio =
        (s.match(/[\u4e00-\u9fffA-Za-z0-9\s.,;:/%$€£¥()\-_]/g) || []).length /
        Math.max(s.length, 1);
      if (ratio >= 0.8) bits.push(s);
    } else if (s && /[\u4e00-\u9fffA-Za-z]{3,}/.test(s)) {
      const ratio =
        (s.match(/[\u4e00-\u9fffA-Za-z0-9\s.,;:/%$€£¥()\-_]/g) || []).length /
        Math.max(s.length, 1);
      if (ratio >= 0.85) bits.push(s);
    }
  }

  const hexRe = /<([0-9A-Fa-f\s]{8,})>/g;
  while ((m = hexRe.exec(raw)) && bits.join('').length < 12000) {
    const hex = m[1].replace(/\s+/g, '');
    if (hex.length % 2 !== 0 || hex.length < 8) continue;
    try {
      const bytes = Buffer.from(hex, 'hex');
      let decoded = '';
      if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
        for (let i = 2; i + 1 < bytes.length; i += 2) {
          const code = (bytes[i] << 8) | bytes[i + 1];
          if (code === 0) continue;
          decoded += String.fromCharCode(code);
        }
      } else {
        let zeroHigh = 0;
        for (let i = 0; i + 1 < bytes.length; i += 2) {
          if (bytes[i] === 0) zeroHigh++;
        }
        const pairs = Math.floor(bytes.length / 2);
        if (pairs > 2 && zeroHigh / pairs >= 0.5) {
          for (let i = 0; i + 1 < bytes.length; i += 2) {
            const code = (bytes[i] << 8) | bytes[i + 1];
            if (code) decoded += String.fromCharCode(code);
          }
        } else {
          decoded = bytes.toString('utf8');
        }
      }
      const s = decoded.replace(/\u0000/g, '').trim();
      if (s && /[\u4e00-\u9fffA-Za-z0-9]/.test(s)) {
        const ratio =
          (s.match(/[\u4e00-\u9fffA-Za-z0-9\s.,;:/%$€£¥()\-_]/g) || []).length /
          Math.max(s.length, 1);
        if (ratio >= 0.75) bits.push(s);
      }
    } catch {
      /* ignore bad hex */
    }
  }

  return normalizeExtracted(bits.join(' ')).slice(0, MAX_TEXT_CHARS);
}

/**
 * Extract readable text from a PDF buffer.
 * Prefer page-capped unpdf; fall back to string scrape; never throw to callers.
 */
export async function extractPdfText(
  buffer: Buffer | Uint8Array
): Promise<PdfExtractResult> {
  const data = toCleanUint8Array(buffer);
  const byteLen = data.byteLength;
  const large = byteLen >= LARGE_PDF_BYTES;
  /** Huge PDFs: try cheap scrape first so Worker may skip full pdf.js parse. */
  const huge = byteLen >= 12 * 1024 * 1024;

  let text = '';
  let pageCount = 0;
  let pagesExtracted = 0;
  let truncated = false;
  let source: PdfExtractResult['source'] = 'none';
  let parseError = false;

  if (huge) {
    try {
      const fallbackFirst = extractPdfTextFallback(buffer);
      if (looksLikeReadableText(fallbackFirst)) {
        text = fallbackFirst;
        source = 'fallback';
      }
    } catch {
      /* continue to unpdf */
    }
  }

  // Always try page-capped unpdf unless fallback already gave plenty of text.
  if (usefulCharCount(text) < EARLY_STOP_CHARS) {
    try {
      const pageResult = await extractViaUnpdfPages(data);
      if (usefulCharCount(pageResult.text) > usefulCharCount(text)) {
        text = pageResult.text;
        pageCount = pageResult.pageCount;
        pagesExtracted = pageResult.pagesExtracted;
        truncated = pageResult.truncated;
        source = 'unpdf';
      } else if (pageResult.pageCount) {
        pageCount = pageResult.pageCount;
        pagesExtracted = pageResult.pagesExtracted;
        truncated = truncated || pageResult.truncated;
      }
    } catch {
      parseError = source === 'none';
      /* Workers / odd PDFs — try fallback below */
    }
  }

  if (!looksLikeReadableText(text)) {
    try {
      const fallback = extractPdfTextFallback(buffer);
      if (
        looksLikeReadableText(fallback) &&
        usefulCharCount(fallback) > usefulCharCount(text)
      ) {
        text = fallback;
        source = 'fallback';
        parseError = false;
      }
    } catch {
      if (source === 'none') parseError = true;
    }
  }

  const useful = looksLikeReadableText(text);
  if (!useful) {
    // Prefer 'empty' (scan) when pdf.js opened the doc; 'parse_error' only if
    // we never got a usable pipeline result (Worker OOM / throw before pages).
    const reason =
      parseError && source === 'none' ? 'parse_error' : 'empty';
    return {
      text: '',
      pageCount,
      pagesExtracted,
      likelyScannedOrEmpty: true,
      source: source === 'none' ? 'none' : source,
      reason,
    };
  }

  let reason: PdfExtractResult['reason'] = 'ok';
  if (truncated || (large && pageCount > pagesExtracted)) {
    reason = large ? 'too_large_partial' : 'partial';
  }

  return {
    text: text.slice(0, MAX_TEXT_CHARS),
    pageCount,
    pagesExtracted,
    likelyScannedOrEmpty: false,
    source,
    reason,
  };
}

/** Chinese note when PDF has no extractable text (scan / image-only / parse fail). */
export function pdfEmptyExtractNote(
  fileName: string,
  size: number,
  reason: PdfExtractResult['reason'] = 'empty'
): string {
  const sizeLabel =
    size >= 1024 * 1024
      ? `${(size / (1024 * 1024)).toFixed(1)}MB`
      : `${size} bytes`;
  if (reason === 'parse_error') {
    return `文件「${fileName}」（${sizeLabel}）已入库，但正文抽取失败（体积过大或解析超时）。文件已保存在企业资料库；请压缩/拆分 PDF 后重传，或另传 txt/csv 要点。OCR 暂不支持。`;
  }
  return `文件「${fileName}」（${sizeLabel}）已入库，但未能抽取正文（可能为扫描件/图片型 PDF；OCR 暂不支持）。请在对话中粘贴厂册要点，或另传 txt/csv。`;
}

/** Prefix when we only got the first pages of a large brochure. */
export function pdfPartialExtractPrefix(
  pagesExtracted: number,
  pageCount: number
): string {
  if (pageCount > 0 && pagesExtracted > 0 && pagesExtracted < pageCount) {
    return `【摘录自前 ${pagesExtracted}/${pageCount} 页】\n`;
  }
  if (pagesExtracted > 0) {
    return `【摘录自前 ${pagesExtracted} 页】\n`;
  }
  return '';
}

/** True when textPreview is only a system placeholder, not real body text. */
export function isAssetTextPlaceholder(preview: string): boolean {
  const t = (preview || '').trim();
  if (!t) return true;
  return (
    t.startsWith('已上传 PDF') ||
    t.startsWith('已上传文件') ||
    t.startsWith('文件「') ||
    t.startsWith('资料「') ||
    t.includes('正文抽取有限') ||
    t.includes('未能抽取正文') ||
    t.includes('正文抽取失败') ||
    t.includes('OCR 暂不支持') ||
    t.includes('已入库，但') ||
    t.includes('【已重试抽取】')
  );
}
