// R2 Workers binding helper. Only import this from Workers runtime paths
// (lazy dynamic import gated on isCloudflareWorker). Uses env.BUCKET from
// wrangler r2_buckets binding — not the S3-compatible STORAGE_* credentials.
import { env } from 'cloudflare:workers';

type R2ObjectBody = {
  body: ReadableStream | null;
  arrayBuffer(): Promise<ArrayBuffer>;
};

type R2BucketLike = {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | string | Blob | null,
    options?: {
      httpMetadata?: { contentType?: string; contentDisposition?: string };
      customMetadata?: Record<string, string>;
    }
  ): Promise<unknown>;
  delete(key: string | string[]): Promise<void>;
  get(key: string): Promise<R2ObjectBody | null>;
};

export function getR2Bucket(): R2BucketLike | null {
  const binding = (env as { BUCKET?: R2BucketLike }).BUCKET;
  return binding ?? null;
}

export async function putEnterpriseObject(options: {
  key: string;
  body: Uint8Array | ArrayBuffer;
  contentType?: string;
}): Promise<{ key: string }> {
  const bucket = getR2Bucket();
  if (!bucket) {
    throw new Error(
      'R2 binding `BUCKET` not found. Confirm r2_buckets (binding: BUCKET) is set in wrangler config and the bucket exists.'
    );
  }
  await bucket.put(options.key, options.body, {
    httpMetadata: {
      contentType: options.contentType || 'application/octet-stream',
      contentDisposition: 'inline',
    },
  });
  return { key: options.key };
}

/** Read an enterprise-uploads object back as bytes (for PDF re-extract). */
export async function getEnterpriseObject(
  key: string
): Promise<Uint8Array | null> {
  const bucket = getR2Bucket();
  if (!bucket) return null;
  const obj = await bucket.get(key);
  if (!obj) return null;
  if (typeof obj.arrayBuffer === 'function') {
    return new Uint8Array(await obj.arrayBuffer());
  }
  if (!obj.body) return null;
  const reader = obj.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}
