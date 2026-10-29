import { getAllConfigs } from '@/modules/config/service';

import { GoogleAnalytics } from './google-analytics';
import { Plausible } from './plausible';

// Server component — reads the merged env+DB config (1h-cached in the
// config service, so no per-request DB hit) and renders whichever
// provider scripts have non-empty IDs configured. Drop this into the
// root layout's <body>; no client/admin gating yet (analytics IDs are
// public anyway and admin pages are a small slice of traffic).
export async function Analytics() {
  const configs = await getAllConfigs();
  const gaId = configs.google_analytics_id?.trim();
  const plausibleDomain = configs.plausible_domain?.trim();
  const plausibleSrc = configs.plausible_src?.trim();

  if (!gaId && !plausibleDomain) return null;

  return (
    <>
      {gaId ? <GoogleAnalytics measurementId={gaId} /> : null}
      {plausibleDomain ? (
        <Plausible domain={plausibleDomain} src={plausibleSrc || undefined} />
      ) : null}
    </>
  );
}
