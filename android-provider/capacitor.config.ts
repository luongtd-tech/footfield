import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.footfield.provider',
  appName: 'Footfield Provider',
  webDir: 'www',
  server: {
    url: 'https://footfield.onrender.com/provider-admin.html',
    cleartext: true
  }
};

export default config;
