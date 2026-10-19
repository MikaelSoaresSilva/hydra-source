import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lifeleveling.awakening',
  appName: 'Life Leveling',
  webDir: 'dist',
  backgroundColor: '#05060c',
  android: { allowMixedContent: false },
  plugins: {
    LocalNotifications: { smallIcon: 'ic_stat_icon', iconColor: '#4cc9ff' },
  },
};

export default config;
