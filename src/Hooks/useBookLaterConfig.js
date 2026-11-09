import { useEffect, useRef, useState } from 'react';
import usePostRequest from '@/Services/Api';
import useNetworkStatus from '@/Hooks/useNetworkStatus';
import { Constants } from '@/Utils';

// booking/get_config/ has no backend route yet, so noticeText stays null and
// the notice is built from the booking's cancellation_policy percent instead.

const DEFAULT_MIN_LEAD_MINUTES = 120;
const DEFAULT_MAX_WINDOW_DAYS = 30;

/**
 * Book Later server + app feature flag. On error or flag off → enabled false.
 */
const useBookLaterConfig = () => {
  const getConfigRequest = usePostRequest();
  const isOnline = useNetworkStatus();
  const wasOnlineRef = useRef(isOnline);
  const lastFetchAt = useRef(0);
  const [config, setConfig] = useState({
    enabled: true,
    minLeadMinutes: DEFAULT_MIN_LEAD_MINUTES,
    maxWindowDays: DEFAULT_MAX_WINDOW_DAYS,
    serverOffsetMs: 0,
    noticeText: null,
    leadTimeSubtitleHours: 2,
  });

  const fetchConfig = () => {
    if (!Constants.FEATURE_STATUS.BOOK_LATER) {
      setConfig(prev => ({ ...prev, enabled: false }));
      return;
    }

    const now = Date.now();
    if (now - lastFetchAt.current < 5000 && lastFetchAt.current > 0) {
      return;
    }
    lastFetchAt.current = now;
    getConfigRequest.makePostRequest(Constants.ENDPOINT.GET_BOOKING_CONFIG, {});
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    const cameBackOnline = isOnline && !wasOnlineRef.current;
    wasOnlineRef.current = isOnline;
    if (cameBackOnline && !getConfigRequest.response) {
      lastFetchAt.current = 0;
      fetchConfig();
    }
  }, [isOnline]);

  useEffect(() => {
    if (!Constants.FEATURE_STATUS.BOOK_LATER) {
      return;
    }

    if (getConfigRequest.error) {
      setConfig(prev => ({ ...prev, enabled: true }));
      return;
    }

    const results = getConfigRequest.response;
    if (results?.code !== 200 || !results?.data) {
      return;
    }

    const data = results.data;
    const minLeadMinutes =
      Number(data.min_lead_minutes ?? data.book_later_min_lead_minutes) ||
      DEFAULT_MIN_LEAD_MINUTES;
    const maxWindowDays =
      Number(data.max_window_days ?? data.book_later_max_days) ||
      DEFAULT_MAX_WINDOW_DAYS;

    let serverOffsetMs = 0;
    if (data.server_time) {
      const serverMs = new Date(data.server_time).getTime();
      if (!Number.isNaN(serverMs)) {
        serverOffsetMs = serverMs - Date.now();
      }
    } else if (data.server_time_ms) {
      serverOffsetMs = Number(data.server_time_ms) - Date.now();
    }

    const noticeText =
      data.passenger_cancellation_notice ||
      data.cancellation_notice_text ||
      data.scheduled_cancellation_notice ||
      null;

    const leadHours = Math.max(1, Math.round(minLeadMinutes / 60));

    setConfig({
      enabled: !!data.book_later_enabled,
      minLeadMinutes,
      maxWindowDays,
      serverOffsetMs,
      noticeText,
      leadTimeSubtitleHours: leadHours,
    });
  }, [getConfigRequest.response, getConfigRequest.error]);

  const enabled =
    Constants.FEATURE_STATUS.BOOK_LATER === true && config.enabled;

  return {
    ...config,
    enabled,
    refetch: fetchConfig,
  };
};

export default useBookLaterConfig;
