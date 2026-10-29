import { S3Provider, storageManager } from '@/core/storage';
import { envConfigs } from '@/config';

let initialized = false;

export function isStorageConfigured() {
  return Boolean(
    envConfigs.storage_endpoint &&
    envConfigs.storage_access_key &&
    envConfigs.storage_secret_key &&
    envConfigs.storage_bucket
  );
}

export function getStorage() {
  if (!initialized) {
    if (isStorageConfigured()) {
      storageManager.addProvider(
        new S3Provider({
          endpoint: envConfigs.storage_endpoint,
          region: envConfigs.storage_region || 'auto',
          accessKeyId: envConfigs.storage_access_key,
          secretAccessKey: envConfigs.storage_secret_key,
          bucket: envConfigs.storage_bucket,
          publicDomain: envConfigs.storage_public_domain,
        }),
        true
      );
    }
    initialized = true;
  }
  return storageManager;
}
