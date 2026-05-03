import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.footfield.tenant',
  appName: 'Footfield Tenant',
  webDir: 'www',
  server: {
    url: 'https://footfield.onrender.com/tenant-admin.html',
    cleartext: true
  }
};

export default config;
