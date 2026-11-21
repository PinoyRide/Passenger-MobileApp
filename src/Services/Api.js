var qs = require('qs');
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { AppUtil, Constants } from '@/Utils';
import { useSelector } from 'react-redux';
import { selectUserInfo } from '@/Redux/Slices/userSlice';
import { getCurrentRouteName, navigate } from '@/Utils/NavigationService';
import { checkIsOnline } from '@/Utils/Network';

const REQUEST_TIMEOUT_MS = 15000;
const OFFLINE_MESSAGE =
  'No internet connection. Please check your connection and try again.';

// Force-update signal is code === 426, from ANY endpoint.
function getForceUpdateData(data) {
  if (data?.code === 426) {
    return data?.data || {}; // { update_link, current_version, minimum_version }
  }
  return null;
}

function handleForceUpdate(fu) {
  if (getCurrentRouteName() === 'UpdateRequiredScreen') {
    return;
  } // already there

  navigate('UpdateRequiredScreen', {
    updateLink: fu.update_link,
    currentVersion: fu.current_version,
    minimumVersion: fu.minimum_version,
  });
}

// A value counts as a "file" for multipart requests when it looks like an
// image-picker/document-picker asset: an object with a `uri`.
function isFileLike(value) {
  return !!value && typeof value === 'object' && typeof value.uri === 'string';
}

const usePostRequest = () => {
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // True only when the most recent call failed because the device was
  // offline — lets callers (e.g. a polling loop) tell that apart from a
  // real API error and stay silent instead of alert-spamming the user.
  const [isOffline, setIsOffline] = useState(false);

  // Bumped on every call. A response/error is only applied to state if it
  // still belongs to the latest call — this stops an old, slow-to-resolve
  // request (e.g. one made right before a connection drop) from landing
  // AFTER a newer request already resolved and overwriting fresher state
  // with stale data. This is what caused bookings to get stuck showing an
  // old status after reconnecting.
  const requestIdRef = useRef(0);

  const userInfo = useSelector(selectUserInfo);

  function isOK(res) {
    return res?.data?.status === Constants.API_OK;
  }

  function isNotOK(res) {
    return (
      res?.data?.status === 'error' ||
      res?.data?.status === Constants.API_NOT_OK
    );
  }

  // Builds the standard param set every endpoint sends: user_type,
  // customer_id, app_version + a hash signature over every value.
  async function buildParams(obj) {
    const requiredParams = {
      user_type: 'customer',
      customer_id: userInfo?.id,
      app_version: '2.0.6',
    };
    const params = { ...requiredParams, ...obj };

    let stringParams = '';
    for (const key in params) {
      if (params[key] !== undefined && params[key] !== null) {
        stringParams += params[key];
      }
    }

    const sig = await AppUtil.getHash(512, stringParams);
    return { ...params, signature: sig };
  }

  // Splits a params object into { fields, files } so multipart requests can
  // append plain values as form fields and file-like values as attachments.
  function splitFilesFromFields(obj) {
    const fields = {};
    const files = {};
    for (const key in obj) {
      const value = obj[key];
      if (value === undefined || value === null) {
        continue;
      }
      if (isFileLike(value)) {
        files[key] = value;
      } else {
        fields[key] = value;
      }
    }
    return { fields, files };
  }

  const extractErrorMessage = errorData => {
    // Handle string errors
    if (typeof errorData === 'string') {
      return errorData;
    }

    // Handle object errors
    if (errorData && typeof errorData === 'object') {
      // Check for non_field_errors array (most common Django/DRF format)
      if (Array.isArray(errorData.non_field_errors)) {
        return errorData.non_field_errors.join('\n');
      }

      // Check for non_field_errors string
      if (typeof errorData.non_field_errors === 'string') {
        return errorData.non_field_errors;
      }

      // Check for message field (could be string or object)
      if (errorData.message) {
        // If message is an object, recursively extract from it
        if (typeof errorData.message === 'object') {
          return extractErrorMessage(errorData.message);
        }
        return errorData.message;
      }

      // Check for detail field (common in Django REST Framework)
      if (errorData.detail) {
        if (typeof errorData.detail === 'object') {
          return extractErrorMessage(errorData.detail);
        }
        return errorData.detail;
      }

      // Check for error field
      if (errorData.error) {
        if (typeof errorData.error === 'object') {
          return extractErrorMessage(errorData.error);
        }
        return errorData.error;
      }

      // Handle field-specific errors (e.g., {email: ["Invalid email"], password: ["Too short"]})
      const fieldErrors = [];
      for (const [key, value] of Object.entries(errorData)) {
        // Skip common metadata fields
        if (['status', 'code', 'timestamp'].includes(key)) {
          continue;
        }

        if (Array.isArray(value)) {
          // If it's an array, extract all messages
          const messages = value.filter(v => typeof v === 'string');
          if (messages.length > 0) {
            fieldErrors.push(messages.join('\n'));
          }
        } else if (typeof value === 'string') {
          fieldErrors.push(value);
        }
      }

      if (fieldErrors.length > 0) {
        return fieldErrors.join('\n');
      }

      // Last resort: return a generic message instead of stringified object
      return 'An error occurred. Please try again.';
    }

    // Fallback
    return 'An unknown error occurred';
  };

  useEffect(() => {
    if (error) {
      AppUtil.debug('❌ Error:', error);
    }
  }, [error]);

  const baseUrl = Constants.BASE_URI;

  /**
   * @param {string} endpoint
   * @param {object} obj - request params. Merged with the standard
   *   user_type/customer_id/app_version/signature envelope. For
   *   contentType 'multipart', any value shaped like { uri, name, type }
   *   (an image/document-picker asset) is sent as a file attachment;
   *   everything else is sent as a plain field.
   * @param {object} config - extra axios config, merged in last.
   * @param {'form'|'json'|'multipart'} contentType
   */
  const makePostRequest = async (
    endpoint,
    obj,
    config = {},
    contentType = 'form',
  ) => {
    const thisRequestId = ++requestIdRef.current;
    const isLatest = () => thisRequestId === requestIdRef.current;

    setLoading(true);
    setError(null);
    setIsOffline(false);

    const online = await checkIsOnline();
    if (!online) {
      if (isLatest()) {
        setError(OFFLINE_MESSAGE);
        setIsOffline(true);
        setLoading(false);
      }
      return { response: null, error: OFFLINE_MESSAGE, offline: true };
    }

    try {
      const url = baseUrl + endpoint;

      const params = await buildParams(obj);

      AppUtil.debug('=====> PARAMS <=====');
      AppUtil.debug(url);
      AppUtil.debugDeep(params);

      let requestData;
      const headers = {
        'x-api-key': Constants.API_KEY,
      };

      if (contentType === 'multipart') {
        const { fields, files } = splitFilesFromFields(params);
        const form = new FormData();
        for (const key in fields) {
          form.append(key, String(fields[key]));
        }
        for (const key in files) {
          const file = files[key];
          form.append(key, {
            uri: file.uri,
            name: file.fileName || file.name || 'upload.jpg',
            type: file.type || 'image/jpeg',
          });
        }
        requestData = form;
        headers['Content-Type'] = 'multipart/form-data';
      } else if (contentType === 'json') {
        requestData = params;
        headers['Content-Type'] = 'application/json';
      } else {
        requestData = qs.stringify(params);
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }

      const res = await axios.post(url, requestData, {
        headers,
        timeout: REQUEST_TIMEOUT_MS,
        ...config,
      });

      // 🛑 Stale-response guard: a newer request has already fired (and
      // possibly already resolved) since this one started — e.g. this call
      // was in flight when the connection dropped and only resolved after
      // reconnection, by which point a fresher poll already succeeded.
      // Applying it now would regress the UI to old data.
      if (!isLatest()) {
        return { response: res.data, error: null, stale: true };
      }

      // Always set response
      setResponse(res.data);

      // Force-update check — code 426, from ANY endpoint.
      const forceUpdate = getForceUpdateData(res.data);
      if (forceUpdate) {
        handleForceUpdate(forceUpdate);
        return { response: null, error: null, forceUpdate: true };
      }

      if (isOK(res)) {
        return { response: res.data, error: null };
      } else if (isNotOK(res)) {
        //  Extract error message properly
        const errorMessage = extractErrorMessage(res.data.message || res.data);
        setError(errorMessage);
        return { response: null, error: errorMessage };
      } else {
        return { response: res.data, error: null };
      }
    } catch (err) {
      if (!isLatest()) {
        return { response: null, error: null, stale: true };
      }

      // Force-update check on the thrown-error path — a 426 status makes
      // axios throw, and the payload lands in err.response.data.
      const forceUpdate = getForceUpdateData(err.response?.data);
      if (forceUpdate) {
        handleForceUpdate(forceUpdate);
        return { response: null, error: null, forceUpdate: true };
      }

      let message = '';
      let offline = false;

      //  Handle error response with proper extraction
      if (err.response?.data) {
        // Try to extract message from response data
        message = extractErrorMessage(err.response.data);
      } else if (err.response) {
        // Generic server error
        message =
          'We are currently under system maintenance. Please try again later.';
      } else if (err.code === 'ECONNABORTED') {
        // Our own timeout fired — connection is too weak/slow to complete.
        message = OFFLINE_MESSAGE;
        offline = true;
      } else if (err.request) {
        // Network error (request went out, no response came back at all)
        message =
          'Oops, you may have weak or no data connection... Keep calm, wait for a few minutes and try again.';
        offline = true;
      } else {
        // Other error
        message = err.message || 'An unknown error occurred';
      }

      setError(message);
      setIsOffline(offline);
      return { response: null, error: message, offline };
    } finally {
      if (isLatest()) {
        setLoading(false);
      }
    }
  };

  return { makePostRequest, response, loading, error, isOffline };
};

export default usePostRequest;
