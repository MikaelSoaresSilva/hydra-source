import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.titan.transformacao',
  appName: 'Titan',
  webDir: 'dist',
  android: { allowMixedContent: false },
};

export default config;
