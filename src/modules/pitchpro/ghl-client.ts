import { envConfigs } from '@/config';

export type GhlMode = 'mock' | 'live';

export type GhlOutreachEmail = {
  subject: string;
  body: string;
  languageName: string;
  markdown: string;
};

export type GhlSyncPreview = {
  mode: GhlMode;
  contact: {
    name: string;
    email: string;
    phone: string;
  };
  note: string;
  attachmentTitles: string[];
  opportunityName: string;
  locationId: string | null;
  pipelineId: string | null;
  pipelineStageId: string | null;
  /** Always present for copy-to-clipboard (market language). */
  outreachEmail: GhlOutreachEmail;
};

export type GhlSyncResult = {
  mode: GhlMode;
  ok: boolean;
  externalContactId: string;
  externalOpportunityId: string;
  raw: unknown;
  errorMessage?: string;
};

export function getGhlMode(): GhlMode {
  return envConfigs.ghl_api_key && envConfigs.ghl_location_id ? 'live' : 'mock';
}

export function isGhlConfigured() {
  return getGhlMode() === 'live';
}

/** Build preview payload — same shape for mock and live. */
export function buildGhlPreview(input: {
  brandName: string;
  country: string;
  track: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  note?: string;
  attachmentTitles?: string[];
  outreachEmail: GhlOutreachEmail;
}): GhlSyncPreview {
  const brand = input.brandName || '目标品牌';
  const outreach = input.outreachEmail;
  return {
    mode: getGhlMode(),
    contact: {
      name: input.contactName || `${brand} Buyer`,
      email:
        input.contactEmail ||
        `buyer@${brand.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'example'}.com`,
      phone: input.contactPhone || '',
    },
    note:
      input.note ||
      outreach.markdown ||
      `呈品提案包：${brand}（${input.country || '未定'} · ${input.track || '未定赛道'}）。请查收概念与开发信。`,
    attachmentTitles: input.attachmentTitles || [],
    opportunityName: `${brand} · 新品类共创`,
    locationId: envConfigs.ghl_location_id || null,
    pipelineId: envConfigs.ghl_pipeline_id || null,
    pipelineStageId: envConfigs.ghl_pipeline_stage_id || null,
    outreachEmail: outreach,
  };
}

/**
 * Push contact + note (+ optional opportunity) to GHL.
 * Without credentials, returns a successful mock result.
 */
export async function pushGhlSync(
  preview: GhlSyncPreview
): Promise<GhlSyncResult> {
  if (preview.mode === 'mock') {
    const mockId = `mock_${Date.now().toString(36)}`;
    return {
      mode: 'mock',
      ok: true,
      externalContactId: `contact_${mockId}`,
      externalOpportunityId: `opp_${mockId}`,
      raw: {
        mock: true,
        message: 'GHL 未配置，已写入本地 mock 同步记录',
        preview,
      },
    };
  }

  const base = envConfigs.ghl_api_base.replace(/\/$/, '');
  const headers: Record<string, string> = {
    Authorization: `Bearer ${envConfigs.ghl_api_key}`,
    Version: '2021-07-28',
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  try {
    // Upsert-ish: create contact
    const contactRes = await fetch(`${base}/contacts/`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        locationId: envConfigs.ghl_location_id,
        name: preview.contact.name,
        email: preview.contact.email,
        phone: preview.contact.phone || undefined,
        source: 'PitchPro',
        tags: ['pitchpro', '共创提案'],
      }),
    });
    const contactJson: any = await contactRes.json().catch(() => ({}));
    if (!contactRes.ok) {
      return {
        mode: 'live',
        ok: false,
        externalContactId: '',
        externalOpportunityId: '',
        raw: contactJson,
        errorMessage:
          contactJson?.message ||
          contactJson?.error ||
          `GHL contact HTTP ${contactRes.status}`,
      };
    }
    const contactId =
      contactJson?.contact?.id ||
      contactJson?.id ||
      contactJson?.contactId ||
      '';

    // Note on contact
    if (contactId && preview.note) {
      await fetch(`${base}/contacts/${contactId}/notes`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          body: [
            preview.note,
            preview.attachmentTitles.length
              ? `\n附件：${preview.attachmentTitles.join('、')}`
              : '',
          ].join(''),
        }),
      }).catch(() => null);
    }

    let opportunityId = '';
    if (
      contactId &&
      envConfigs.ghl_pipeline_id &&
      envConfigs.ghl_pipeline_stage_id
    ) {
      const oppRes = await fetch(`${base}/opportunities/`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          locationId: envConfigs.ghl_location_id,
          pipelineId: envConfigs.ghl_pipeline_id,
          pipelineStageId: envConfigs.ghl_pipeline_stage_id,
          name: preview.opportunityName,
          status: 'open',
          contactId,
        }),
      });
      const oppJson: any = await oppRes.json().catch(() => ({}));
      if (oppRes.ok) {
        opportunityId =
          oppJson?.opportunity?.id || oppJson?.id || oppJson?.opportunityId || '';
      }
    }

    return {
      mode: 'live',
      ok: true,
      externalContactId: contactId,
      externalOpportunityId: opportunityId,
      raw: { contact: contactJson },
    };
  } catch (e: any) {
    return {
      mode: 'live',
      ok: false,
      externalContactId: '',
      externalOpportunityId: '',
      raw: null,
      errorMessage: e.message || 'GHL 请求失败',
    };
  }
}
