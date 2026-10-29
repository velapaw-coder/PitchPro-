import { getAllConfigs } from '@/modules/config/service';

import { Crisp } from './crisp';
import { Tawk } from './tawk';

export async function CustomerService() {
  const configs = await getAllConfigs();

  const crispEnabled = configs.crisp_enabled === 'true';
  const crispWebsiteId = configs.crisp_website_id?.trim();

  const tawkEnabled = configs.tawk_enabled === 'true';
  const tawkPropertyId = configs.tawk_property_id?.trim();
  const tawkWidgetId = configs.tawk_widget_id?.trim();

  if (!crispEnabled && !tawkEnabled) return null;

  return (
    <>
      {crispEnabled && crispWebsiteId ? (
        <Crisp websiteId={crispWebsiteId} />
      ) : null}
      {tawkEnabled && tawkPropertyId && tawkWidgetId ? (
        <Tawk propertyId={tawkPropertyId} widgetId={tawkWidgetId} />
      ) : null}
    </>
  );
}
