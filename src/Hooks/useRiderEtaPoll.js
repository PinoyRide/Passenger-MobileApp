import { useEffect, useRef } from 'react';
import usePostRequest from '@/Services/Api';
import { Constants } from '@/Utils';

const DEFAULT_REFRESH_S = 15;

/**
 * Polls POST booking/get_eta while a booking is accepted (status 1) or in
 * transit (status 2) and maps {eta_state, eta_minutes, pretty_eta} to the
 * shape used by getRiderEtaText / getDropoffEtaText.
 * Re-ticks immediately when status changes so Begin Ride / status 2 does not
 * wait for the previous refresh timer.
 */
const useRiderEtaPoll = ({ bookingId, customerId, enabled, status, onEta }) => {
  const api = usePostRequest();
  const onEtaRef = useRef(onEta);
  onEtaRef.current = onEta;

  useEffect(() => {
    if (!enabled || !bookingId) {
      return undefined;
    }
    let cancelled = false;
    let timer;
    const tick = async () => {
      const { response } = await api.makePostRequest(
        Constants.ENDPOINT.GET_ETA,
        { booking_id: bookingId, customer_id: customerId },
      );
      if (cancelled) {
        return;
      }
      const d = response?.data;
      if (d && d.eta_state) {
        onEtaRef.current?.({
          state: d.eta_state,
          eta_minutes: d.eta_minutes,
          pretty: d.pretty_eta,
          leg: d.leg,
        });
      }
      const next = Number(d?.refresh_after_seconds) || DEFAULT_REFRESH_S;
      if (d?.eta_state !== 'arrived') {
        timer = setTimeout(tick, Math.max(5, next) * 1000);
      }
    };
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, bookingId, customerId, status]);
};

export default useRiderEtaPoll;
