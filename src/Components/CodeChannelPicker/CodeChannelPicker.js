import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { modern } from '@/Theme/modern';
import { EMAIL, SMS, emailChoice, maskedMobile } from '@/Utils/codeChannel';

// Where a sign-in code goes: a text message to the number, or an email to the
// address on the account (the owner, 2026-11-22; the same in both apps). Two
// cards, one chosen; email is greyed out when the account has no address.
// The screen that shows it has the button that sends the code.
const CodeChannelPicker = ({
  mobileNumber,
  options,
  selected,
  onSelect,
  disabled = false,
}) => {
  const look = modern(useTheme());
  const styles = getStyles(look);
  const email = emailChoice(options);

  const card = ({ channel, icon, title, detail, available = true }) => {
    const chosen = selected === channel;
    const off = !available || disabled;
    return (
      <TouchableOpacity
        key={channel}
        style={[
          styles.card,
          chosen && styles.cardChosen,
          !available && styles.cardUnavailable,
        ]}
        onPress={() => onSelect(channel)}
        disabled={off}
        activeOpacity={0.75}
        accessibilityRole="radio"
        accessibilityLabel={`${title}, ${detail}`}
        accessibilityState={{ checked: chosen, disabled: off }}>
        <View style={[styles.chip, !available && styles.chipUnavailable]}>
          <Icon
            name={icon}
            size={21}
            color={available ? look.chipInk : look.muted}
          />
        </View>
        <View style={styles.words}>
          <Text style={[styles.title, !available && styles.mutedText]}>
            {title}
          </Text>
          <Text style={styles.detail} numberOfLines={1}>
            {detail}
          </Text>
        </View>
        <View style={[styles.radio, chosen && styles.radioChosen]}>
          {chosen ? <View style={styles.radioDot} /> : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View accessibilityRole="radiogroup" style={styles.group}>
      {card({
        channel: SMS,
        icon: 'message-text-outline',
        title: 'Text message',
        detail: maskedMobile(mobileNumber),
      })}
      {card({
        channel: EMAIL,
        icon: 'email-outline',
        title: 'Email',
        detail: email.detail,
        available: email.available,
      })}
    </View>
  );
};

export default CodeChannelPicker;

const getStyles = look =>
  StyleSheet.create({
    group: { gap: 12 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderRadius: look.radius,
      borderWidth: 1.5,
      borderColor: look.hairline,
      backgroundColor: look.surface,
    },
    cardChosen: { borderColor: look.accent },
    cardUnavailable: { backgroundColor: look.soft, borderColor: look.soft },
    chip: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: look.chip,
    },
    chipUnavailable: { backgroundColor: look.hairline },
    words: { flex: 1, gap: 2 },
    title: { fontSize: 15, fontFamily: 'Poppins Medium', color: look.text },
    detail: { fontSize: 13, fontFamily: 'Poppins Regular', color: look.muted },
    mutedText: { color: look.muted },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: look.hairline,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioChosen: { borderColor: look.accent },
    radioDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: look.accent,
    },
  });
