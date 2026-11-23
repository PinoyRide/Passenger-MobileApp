import { Linking, Platform } from 'react-native';
import appAlert from '@/Utils/appAlert';

export const EMERGENCY_NUMBER = '911'; // Philippines national emergency hotline

export const dialEmergency = () => {
  Linking.openURL(`tel:${EMERGENCY_NUMBER}`).catch(() => {
    if (Platform.OS !== 'web') {
      appAlert('Unable to call', `Please dial ${EMERGENCY_NUMBER} manually.`);
    }
  });
};
