// Client for endpoints already ported to the .NET backend (PRTC-BackEnd-Net).
// The .NET API is the app's base URL; routes it has not ported yet are forwarded to
// Django, so everything else keeps using usePostRequest (Services/Api.js).
//
// .NET responses are { success, data, errors[] } with HTTP status codes. They are
// normalised to the envelope screens already check: { status, code, message, data },
// with code 200 for any 2xx.
import { useRef, useState } from 'react';
import axios from 'axios';
import { AppUtil, Constants } from '@/Utils';
import { getCurrentRouteName, navigate } from '@/Utils/NavigationService';
import { checkIsOnline } from '@/Utils/Network';
import { signalSignedOut, signedOutReason } from '@/Utils/signedOut';
import { UPDATING_MESSAGE, isServerDown } from '@/Utils/serverDown';
import { sessionHeader, takeNewToken } from '@/Utils/sessionHeader';
import { installedVersion } from '@/Utils/installedVersion';

const REQUEST_TIMEOUT_MS = 15000;
const OFFLINE_MESSAGE =
  'No internet connection. Please check your connection and try again.';
const WEAK_CONNECTION_MESSAGE =
  'Oops, you may have weak or no data connection... Keep calm, wait for a few minutes and try again.';

// First error's detail (service message) or message (validation field / title).
export function errorMessageOf(body) {
  const first = body?.errors?.[0];
  if (!first) {
    return 'An error occurred. Please try again.';
  }
  return (
    first.details || first.message || 'An error occurred. Please try again.'
  );
}

export function normalise(status, body) {
  const ok = status >= 200 && status < 300 && body?.success !== false;
  return {
    status: ok ? 'success' : 'error',
    code: ok ? 200 : status,
    message: ok
      ? 'Success'
      : isServerDown(status, body)
      ? UPDATING_MESSAGE
      : errorMessageOf(body),
    data: body?.data ?? null,
  };
}

function goToUpdateRequired(data) {
  if (getCurrentRouteName() === 'UpdateRequiredScreen') {
    return;
  }
  navigate('UpdateRequiredScreen', {
    updateLink: data?.updateLink,
    currentVersion: data?.currentVersion,
    minimumVersion: data?.minimumVersion,
  });
}

const useApiRequest = () => {
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);

  /**
   * @param {'GET'|'POST'|'PUT'|'DELETE'} method
   * @param {string} path - relative to Constants.BASE_URI, e.g. `customers/12/logout`
   * @param {object|FormData} [body] - JSON body (camelCase, as the .NET API expects), or FormData for uploads
   * @returns {Promise<{response, error, offline?, forceUpdate?}>}
   */
  const request = async (method, path, body) => {
    const thisRequestId = ++requestIdRef.current;
    const isLatest = () => thisRequestId === requestIdRef.current;

    setLoading(true);
    setError(null);

    if (!(await checkIsOnline())) {
      if (isLatest()) {
        setError(OFFLINE_MESSAGE);
        setLoading(false);
      }
      return { response: null, error: OFFLINE_MESSAGE, offline: true };
    }

    try {
      const res = await axios.request({
        method,
        url: Constants.BASE_URI + path,
        data: body,
        timeout: REQUEST_TIMEOUT_MS,
        validateStatus: () => true, // map every status ourselves
        headers: {
          // FormData (file uploads) gets its multipart boundary from axios
          'Content-Type':
            body instanceof FormData
              ? 'multipart/form-data'
              : 'application/json',
          'X-API-KEY': Constants.API_KEY,
          'X-App-Version': installedVersion(),
          'X-User-Type': 'customer',
          // the passenger's sign-in token: customers/{id}/... answers only
          // with it (Utils/sessionHeader.js)
          ...sessionHeader(),
        },
      });
      // a new sign-in token handed out behind the scenes, even on a stale answer
      takeNewToken(res.headers);

      if (!isLatest()) {
        return { response: null, error: null, stale: true };
      }

      if (res.status === 426) {
        goToUpdateRequired(res.data?.data);
        return { response: null, error: null, forceUpdate: true };
      }

      // Signed out by Pinoy Ride, or the account was deleted — from ANY
      // endpoint (Utils/signedOut.js). The app signs out as Log Out does.
      const signedOut = signedOutReason(res.status, res.data);
      if (signedOut) {
        signalSignedOut(signedOut);
        return { response: null, error: null, signedOut: true };
      }

      const normalised = normalise(res.status, res.data);
      AppUtil.debugDeep({ path, status: res.status, normalised });
      setResponse(normalised);
      if (normalised.code !== 200) {
        setError(normalised.message);
        return { response: null, error: normalised.message };
      }
      return { response: normalised, error: null };
    } catch (err) {
      if (!isLatest()) {
        return { response: null, error: null, stale: true };
      }
      const offline = err.code === 'ECONNABORTED' || !!err.request;
      const message = offline
        ? WEAK_CONNECTION_MESSAGE
        : 'An error occurred. Please try again.';
      setError(message);
      return { response: null, error: message, offline };
    } finally {
      if (isLatest()) {
        setLoading(false);
      }
    }
  };

  return { request, response, loading, error };
};

export default useApiRequest;
