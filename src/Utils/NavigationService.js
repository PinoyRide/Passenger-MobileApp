// QA update test 1: comment only, no change in behaviour.
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}

export function getCurrentRouteName() {
  return navigationRef.isReady()
    ? navigationRef.getCurrentRoute()?.name
    : undefined;
}
