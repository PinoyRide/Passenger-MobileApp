import { installedVersion } from '@/Utils/installedVersion';
import { Constants } from '@/Utils';
import {
  TIMEOUT_MS,
  buildCheckAddress,
  buildRequired,
} from '@/Utils/buildCheck';

// Asks the backend whether the installed build is still accepted. Gives the
// "Update Required" screen's parameters when it is not, otherwise null: also
// when there is no connection or no answer in time, so the app always opens.
export const askBuildCheck = async (app, { tripUnderWay = false } = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const answer = await fetch(
      buildCheckAddress(Constants.BASE_URI, app, installedVersion()),
      { signal: controller.signal, headers: { Accept: 'application/json' } },
    );
    if (!answer.ok) {
      return null;
    }
    return buildRequired(await answer.json(), { tripUnderWay });
  } catch (error) {
    return null;
  } finally {
    clearTimeout(timer);
  }
};
