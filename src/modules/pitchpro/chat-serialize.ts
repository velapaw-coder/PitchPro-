/** Normalize pitch_chat_message.attachments (stored as JSON text) for API clients. */

export type ApiChatAttachment = {
  assetId: string;
  fileName: string;
  title: string;
  mimeType: string;
  size: number;
};

export function safeParseAttachments(
  raw: unknown
): ApiChatAttachment[] {
  if (Array.isArray(raw)) return raw as ApiChatAttachment[];
  if (typeof raw !== 'string') return [];
  try {
    const v = JSON.parse(raw || '[]');
    return Array.isArray(v) ? (v as ApiChatAttachment[]) : [];
  } catch {
    return [];
  }
}

export function toApiChatMessage(row: {
  id: string;
  role: string;
  content: string;
  attachments?: unknown;
  createdAt?: string | Date | null;
}) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    attachments: safeParseAttachments(row.attachments),
    createdAt: row.createdAt ?? undefined,
  };
}

/** Marker used to detect lifestyle narrative seed messages. */
export const NARRATIVE_MARKER = '呈品 · 叙事师';

/** Marker used to detect product-proposal preview messages in left chat. */
export const PROPOSAL_MARKER = '呈品 · 提案';

/** Marker used to detect video brief messages in left chat. */
export const VIDEO_MARKER = '呈品 · 视频';
