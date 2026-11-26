import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { DatePickerModal, TimePickerModal } from 'react-native-paper-dates';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bottomSpace } from '@/Utils/bottomSpace';
import { modern } from '@/Theme/modern';
import {
  dateChips,
  dayText,
  firstPick,
  formatTime,
  pickOnDay,
  sameDay,
  scheduleLabel,
  timeSlots,
} from '@/Utils/scheduleChips';

const TOO_SOON = '__too_soon__';

// Splits the slots into rows of four, padding the last one so every chip
// keeps the same width.
const rowsOfFour = items => {
  const rows = [];
  for (let i = 0; i < items.length; i += 4) {
    rows.push(items.slice(i, i + 4));
  }
  return rows;
};

// The scheduling sheet (docs/booking-redesign-spec.md, "Advance booking", and
// the design canvas): date chips and a 15-minute time grid instead of two
// pickers, which stay one tap away ("Pick another date", "Pick another
// time"). The contract and every rule are the same as before: the minimum
// lead, the booking window, the default pick and the 30-second re-check.
const PickDateModal = ({
  visible,
  onClose,
  onConfirm,
  onRideNow,
  minLeadMinutes = 120,
  maxWindowDays = 30,
  serverOffsetMs = 0,
  leadTimeSubtitleHours = 2,
}) => {
  const look = modern(useTheme());
  const styles = getStyles(look);
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

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

  // Opens on now + lead + 5 minutes (the code's default), on the grid's next
  // 15-minute step.
  useEffect(() => {
    if (!visible) {
      return;
    }
    const defaultDate = new Date(
      firstPick({ now: correctedNow(), minLeadMinutes }),
    );
    setPickedDate(defaultDate);
    setValidationError(validateSelection(defaultDate));
  }, [visible, minLeadMinutes, serverOffsetMs]);

  // Re-check every 30 s, so a time that drifts inside the lead is greyed out.
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

  const choose = ms => {
    const next = new Date(ms);
    setPickedDate(next);
    runValidation(next);
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

  // Re-read on every render; the 30-second tick re-renders.
  const now = correctedNow();
  const rules = { now, minLeadMinutes, maxWindowDays };
  const picked = pickedDate.getTime();
  const chips = dateChips(rules);
  const slots = timeSlots({ ...rules, day: picked, picked });
  const pickedOnChips = chips.some(chip => sameDay(chip.day, picked));
  const pickedOnSlots = slots.some(slot => slot.at === picked);
  const canSchedule = !validationError;

  const renderDateChip = chip => {
    const selected = sameDay(chip.day, picked);
    return (
      <Pressable
        key={chip.day}
        onPress={() =>
          choose(pickOnDay({ day: chip.day, picked, now, minLeadMinutes }))
        }
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={`${chip.label}, ${chip.date} ${chip.month}`}
        style={[
          styles.dateChip,
          selected ? styles.chipSelected : styles.chipResting,
        ]}>
        <Text style={[styles.chipSmall, selected && styles.onAccent]}>
          {chip.label}
        </Text>
        <Text style={[styles.chipDate, selected && styles.onAccent]}>
          {chip.date}
        </Text>
        <Text style={[styles.chipSmall, selected && styles.onAccent]}>
          {chip.month}
        </Text>
      </Pressable>
    );
  };

  const renderSlot = slot => {
    // a chosen slot that drifted inside the lead is greyed out, not gold
    const selected = slot.at === picked && !slot.disabled;
    return (
      <Pressable
        key={slot.at}
        onPress={() => choose(slot.at)}
        disabled={slot.disabled}
        accessibilityRole="radio"
        accessibilityState={{ selected, disabled: slot.disabled }}
        accessibilityLabel={slot.label}
        style={[
          styles.slot,
          selected ? styles.chipSelected : styles.chipResting,
        ]}>
        <Text
          style={[
            styles.slotText,
            selected && styles.onAccent,
            slot.disabled && styles.greyedText,
          ]}>
          {slot.label}
        </Text>
      </Pressable>
    );
  };

  // "Pick another date" / "Pick another time": when the pick was made there
  // rather than on the chips, the row names it, gold, or greyed out when it
  // has become too soon.
  const renderMore = ({ icon, text, chosenText, chosen, greyed, onPress }) => {
    const gold = chosen && !greyed;
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={[
          styles.moreRow,
          gold ? styles.chipSelected : styles.chipResting,
        ]}>
        <Icon
          name={icon}
          size={17}
          color={gold ? look.onAccent : look.inkSoft}
        />
        <Text
          style={[
            styles.moreText,
            gold && styles.onAccent,
            chosen && greyed && styles.greyedText,
          ]}>
          {chosen ? chosenText : text}
        </Text>
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessible={false}
        />
        <Pressable
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={[styles.close, { top: topInset + 12 }]}>
          <Icon name="close" size={22} color={look.ink} />
        </Pressable>

        <View
          style={[styles.sheet, { maxHeight: windowHeight - topInset - 72 }]}>
          <ScrollView
            bounces={false}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: bottomSpace(bottomInset, 16, 16) },
            ]}>
            <Text style={styles.title} maxFontSizeMultiplier={1.3}>
              Schedule your ride
            </Text>
            <Text style={styles.subtitle}>{subtitle}</Text>

            <Text style={styles.label}>PICK-UP DATE</Text>
            <View style={styles.row}>
              {chips.map(renderDateChip)}
              {Array.from({ length: Math.max(0, 4 - chips.length) }).map(
                (_, i) => (
                  <View key={`pad-${i}`} style={styles.pad} />
                ),
              )}
            </View>
            {renderMore({
              icon: 'calendar-blank-outline',
              text: 'Pick another date',
              chosenText: dayText(picked),
              chosen: !pickedOnChips,
              onPress: () => setShowDatePicker(true),
            })}

            <Text style={[styles.label, styles.labelGap]}>PICK-UP TIME</Text>
            {rowsOfFour(slots).map(row => (
              <View key={row[0].at} style={[styles.row, styles.slotRow]}>
                {row.map(renderSlot)}
                {Array.from({ length: 4 - row.length }).map((_, i) => (
                  <View key={`pad-${i}`} style={styles.pad} />
                ))}
              </View>
            ))}
            {renderMore({
              icon: 'clock-outline',
              text: 'Pick another time',
              chosenText: formatTime(picked),
              chosen: !pickedOnSlots,
              greyed: tooSoon,
              onPress: () => setShowTimePicker(true),
            })}

            {validationError && !tooSoon ? (
              <Text style={styles.errorText}>{validationError}</Text>
            ) : null}

            <Pressable
              onPress={handleConfirm}
              disabled={!canSchedule}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSchedule }}
              style={[styles.cta, !canSchedule && styles.ctaDisabled]}>
              <Text
                style={[
                  styles.ctaText,
                  !canSchedule && styles.ctaTextDisabled,
                ]}>
                {`Schedule for ${scheduleLabel({ picked, now })}`}
              </Text>
            </Pressable>
            <Pressable
              onPress={onRideNow || onClose}
              hitSlop={8}
              accessibilityRole="button"
              style={styles.rideNow}>
              <Text style={styles.rideNowText}>Ride now instead</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>

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

const getStyles = look =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    close: {
      position: 'absolute',
      right: 20,
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: look.surface,
    },
    sheet: {
      backgroundColor: look.surface,
      borderTopLeftRadius: look.radiusSheet,
      borderTopRightRadius: look.radiusSheet,
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 24,
    },
    // Title role
    title: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 22,
      lineHeight: 27,
      letterSpacing: -0.5,
      color: look.ink,
    },
    subtitle: {
      marginTop: 4,
      fontFamily: 'Poppins Regular',
      fontSize: 13,
      lineHeight: 18,
      color: look.muted,
    },
    // Label role
    label: {
      marginTop: 20,
      marginBottom: 10,
      fontFamily: 'Poppins SemiBold',
      fontSize: 11,
      lineHeight: 14,
      letterSpacing: 1.2,
      color: look.muted,
    },
    labelGap: {
      marginTop: 22,
    },
    row: {
      flexDirection: 'row',
      gap: 9,
    },
    slotRow: {
      marginBottom: 9,
    },
    pad: {
      flex: 1,
    },
    dateChip: {
      flex: 1,
      minHeight: 86,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: look.radiusTile + 2,
    },
    slot: {
      flex: 1,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: look.radiusPill,
    },
    // the service card's shadow
    chipSelected: {
      backgroundColor: look.accent,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.09,
      shadowRadius: 10,
      elevation: 4,
    },
    chipResting: {
      backgroundColor: look.soft,
    },
    chipSmall: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 11,
      lineHeight: 14,
      color: look.ink,
      opacity: 0.64,
    },
    chipDate: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 21,
      lineHeight: 26,
      color: look.ink,
    },
    slotText: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 13,
      lineHeight: 18,
      color: look.ink,
    },
    onAccent: {
      color: look.onAccent,
    },
    greyedText: {
      color: look.muted,
    },
    moreRow: {
      marginTop: 9,
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: look.radiusPill,
    },
    moreText: {
      fontFamily: 'Poppins Medium',
      fontSize: 13,
      lineHeight: 18,
      color: look.ink,
    },
    errorText: {
      marginTop: 14,
      fontFamily: 'Poppins Regular',
      fontSize: 13,
      lineHeight: 18,
      color: look.danger,
    },
    cta: {
      marginTop: 22,
      minHeight: 58,
      borderRadius: look.radiusCard - 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
      backgroundColor: look.accent,
    },
    ctaDisabled: {
      backgroundColor: look.soft,
    },
    ctaText: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 16,
      lineHeight: 22,
      color: look.onAccent,
    },
    ctaTextDisabled: {
      color: look.muted,
    },
    rideNow: {
      alignSelf: 'center',
      marginTop: 14,
      paddingVertical: 6,
    },
    rideNowText: {
      fontFamily: 'Poppins Medium',
      fontSize: 14,
      lineHeight: 20,
      color: look.inkSoft,
    },
  });
