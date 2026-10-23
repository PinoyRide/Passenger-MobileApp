import React, { useEffect, useMemo, useState } from 'react';
import { ON_PRIMARY_BUTTON_TEXT } from '@/Theme';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon, useTheme } from 'react-native-paper';
import { DatePickerModal, TimePickerModal } from 'react-native-paper-dates';
import {
  formatScheduledDateLabel,
  formatScheduledTimeLabel,
} from '@/Hooks/bookLaterFormat';

const TOO_SOON = '__too_soon__';

const PickDateModal = ({
  visible,
  onClose,
  onConfirm,
  minLeadMinutes = 120,
  maxWindowDays = 30,
  serverOffsetMs = 0,
  leadTimeSubtitleHours = 2,
}) => {
  const { colors } = useTheme();
  const styles = getStyles({ colors });

  const correctedNow = () => Date.now() + serverOffsetMs;

  const [pickedDate, setPickedDate] = useState(() => new Date(correctedNow()));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [tick, setTick] = useState(0);

  const validateSelection = date => {
    const now = correctedNow();
    const minTime = now + minLeadMinutes * 60 * 1000;
    const maxTime = now + maxWindowDays * 24 * 60 * 60 * 1000;

    if (date.getTime() < now) {
      return 'Please choose a future date and time.';
    }
    if (date.getTime() < minTime) {
      return TOO_SOON;
    }
    if (date.getTime() > maxTime) {
      return `You can only book up to ${maxWindowDays} days ahead.`;
    }
    return '';
  };

  useEffect(() => {
    if (!visible) {
      return;
    }
    const defaultDate = new Date(
      correctedNow() + minLeadMinutes * 60 * 1000 + 5 * 60 * 1000,
    );
    setPickedDate(defaultDate);
    setValidationError(validateSelection(defaultDate));
  }, [visible, minLeadMinutes, serverOffsetMs]);

  // Re-check every 30 s so a time that drifts inside the 2 h window flips to the Notice.
  useEffect(() => {
    if (!visible) {
      return undefined;
    }
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setValidationError(validateSelection(pickedDate));
    }
  }, [tick]);

  const tooSoon = validationError === TOO_SOON;

  const validRange = useMemo(() => {
    const start = new Date(correctedNow());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + maxWindowDays);
    return { startDate: start, endDate: end };
  }, [maxWindowDays, serverOffsetMs, visible]);

  const runValidation = nextDate => {
    const err = validateSelection(nextDate);
    setValidationError(err);
    return !err;
  };

  const handleDateConfirm = ({ date }) => {
    setShowDatePicker(false);
    if (!date) {
      return;
    }
    const merged = new Date(pickedDate);
    merged.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    setPickedDate(merged);
    runValidation(merged);
  };

  const handleTimeConfirm = ({ hours, minutes }) => {
    setShowTimePicker(false);
    // react-native-paper-dates (12-hour mode) can hand back hours === 24 for
    // 12 PM; setHours(24) rolled the date to tomorrow 12:00 AM. Keep the
    // picked date and clamp to 0-23.
    let h = Number(hours);
    if (h === 24) {
      h = 12;
    }
    h = ((h % 24) + 24) % 24;
    const m = Math.min(59, Math.max(0, Number(minutes) || 0));
    const merged = new Date(pickedDate);
    merged.setHours(h, m, 0, 0);
    setPickedDate(merged);
    runValidation(merged);
  };

  const handleConfirm = () => {
    if (!runValidation(pickedDate)) {
      return;
    }
    onConfirm?.(pickedDate);
  };

  const subtitle = `Book at least ${leadTimeSubtitleHours} hours ahead`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={e => e.stopPropagation()}>
          <Text style={styles.title}>Pick a Date</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <Text style={styles.fieldLabel}>Date</Text>
          <TouchableOpacity
            style={styles.valueRow}
            onPress={() => setShowDatePicker(true)}
            accessibilityRole="button">
            <Text style={styles.valueText}>
              {formatScheduledDateLabel(pickedDate, new Date(correctedNow()))}
            </Text>
            <Icon
              source="calendar-blank-outline"
              size={12}
              color={colors.iconMuted ?? '#D0D0D0'}
            />
          </TouchableOpacity>
          <View style={styles.underline} />

          <Text style={[styles.fieldLabel, styles.timeLabel]}>Time</Text>
          <TouchableOpacity
            style={styles.valueRow}
            onPress={() => setShowTimePicker(true)}
            accessibilityRole="button">
            <Text style={styles.valueText}>
              {formatScheduledTimeLabel(pickedDate)}
            </Text>
            <Icon
              source="clock-outline"
              size={12}
              color={colors.iconMuted ?? '#D0D0D0'}
            />
          </TouchableOpacity>
          <View style={styles.underline} />

          {validationError && !tooSoon ? (
            <Text style={styles.errorText}>{validationError}</Text>
          ) : null}

          <TouchableOpacity
            style={[
              styles.confirmButton,
              validationError ? styles.confirmButtonDisabled : null,
            ]}
            disabled={Boolean(validationError)}
            onPress={handleConfirm}>
            <Text style={styles.confirmLabel}>Confirm Date and Time</Text>
          </TouchableOpacity>
          {tooSoon ? (
            <Text style={styles.noticeText} testID="pick-date-notice">
              <Text style={styles.noticeBold}>Notice: </Text>
              Advance bookings must be scheduled at least{' '}
              {leadTimeSubtitleHours} hours before the pickup time. Please
              select a later pickup time to continue.
            </Text>
          ) : null}
        </Pressable>
      </Pressable>

      <DatePickerModal
        locale="en"
        mode="single"
        visible={showDatePicker}
        onDismiss={() => setShowDatePicker(false)}
        date={pickedDate}
        onConfirm={handleDateConfirm}
        validRange={validRange}
      />
      <TimePickerModal
        visible={showTimePicker}
        onDismiss={() => setShowTimePicker(false)}
        onConfirm={handleTimeConfirm}
        hours={pickedDate.getHours()}
        minutes={pickedDate.getMinutes()}
        use24HourClock={false}
      />
    </Modal>
  );
};

export default PickDateModal;

const getStyles = ({ colors }) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 48,
    },
    card: {
      width: 335,
      backgroundColor: '#FFFFFF',
      borderRadius: 10,
      paddingHorizontal: 32.5,
      paddingTop: 33,
      paddingBottom: 25.5,
    },
    title: {
      fontFamily: 'Poppins Medium',
      fontSize: 16,
      color: '#000000',
      marginBottom: 8,
    },
    subtitle: {
      fontFamily: 'Poppins Regular',
      fontSize: 14,
      color: '#000000',
      marginBottom: 24,
    },
    fieldLabel: {
      fontFamily: 'Poppins Regular',
      fontSize: 14,
      color: colors.grey3 ?? '#7C7C7C',
      marginBottom: 4,
    },
    timeLabel: {
      marginTop: 17,
    },
    valueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 17,
    },
    valueText: {
      fontFamily: 'Poppins Regular',
      fontSize: 14,
      color: colors.onSurface,
    },
    underline: {
      height: 1,
      backgroundColor: colors.divider ?? '#DAD4D4',
      width: '100%',
      marginBottom: 17.5,
    },
    errorText: {
      fontFamily: 'Poppins Regular',
      fontSize: 12,
      color: colors.error,
      marginBottom: 8,
    },
    confirmButton: {
      width: 270,
      height: 37.5,
      borderRadius: 18.5,
      backgroundColor: colors.primary,
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 19.5,
    },
    confirmButtonDisabled: {
      backgroundColor: '#B3B3B3',
    },
    noticeText: {
      fontFamily: 'Poppins Regular',
      fontSize: 11,
      lineHeight: 16,
      color: '#6B6B6B',
      textAlign: 'center',
      marginTop: 10,
    },
    noticeBold: {
      fontFamily: 'Poppins SemiBold',
      fontWeight: '600',
    },
    confirmLabel: {
      fontFamily: 'Poppins Regular',
      fontSize: 14,
      color: ON_PRIMARY_BUTTON_TEXT,
    },
  });
