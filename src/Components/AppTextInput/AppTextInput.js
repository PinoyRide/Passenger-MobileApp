import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { modern } from '@/Theme/modern';
import AppTextError from '../AppTextError/AppTextError';

// Format phone number with dashes: 927-339-4743
const formatPhoneDisplay = number => {
  const cleaned = number.replace(/\D/g, '');

  if (cleaned.length === 0) {
    return '';
  }

  if (cleaned.length <= 3) {
    return cleaned;
  } else if (cleaned.length <= 6) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
  } else {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(
      6,
      10,
    )}`;
  }
};

// Philippine mobile number validation - must start with 9
const validatePhilippineNumber = number => {
  const cleaned = number.replace(/\D/g, '');

  // Empty is okay (no error until they start typing)
  if (cleaned.length === 0) {
    return null;
  }

  // Must start with 9
  if (!cleaned.startsWith('9')) {
    return 'Invalid phone number. Input should start with 9.';
  }

  // Show error for incomplete numbers (less than 10 digits)
  if (cleaned.length < 10) {
    return `+63 ${formatPhoneDisplay(cleaned)} is incomplete.`;
  }

  // Valid when exactly 10 digits starting with 9
  if (cleaned.length === 10) {
    return null;
  }

  return null;
};

const AppTextInput = ({
  label,
  value,
  onChangeText,
  onBlur,
  placeholder,
  inputMode = 'text', // 'text' | 'phone' | 'amount' | 'comment'
  error,
  labelColor,
  onValidationChange,
}) => {
  const theme = useTheme();
  const { colors } = theme;
  const look = modern(theme);
  const styles = getStyles({ colors, look });
  const isPhone = inputMode === 'phone';
  const isAmount = inputMode === 'amount';
  const isComment = inputMode === 'comment';

  const [isFocused, setIsFocused] = useState(false);
  const [phoneError, setPhoneError] = useState(null);
  const [displayPhone, setDisplayPhone] = useState('');

  // Format amount with 2 decimals and commas
  const formatAmount = val => {
    if (!val || val === '') {
      return '';
    }
    const number = parseFloat(val.replace(/,/g, ''));
    if (isNaN(number)) {
      return '';
    }

    const formatted = number.toFixed(2);
    const parts = formatted.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  // Clean input - only allow numbers and one decimal point
  const cleanAmount = val => {
    return val
      .replace(/[^0-9.]/g, '') // Only numbers and decimal
      .replace(/(\..*?)\.+/g, '$1') // Only one decimal point
      .replace(/^0+(?=\d)/, ''); // Remove leading zeros (except "0.")
  };

  const handleAmountChange = val => {
    const cleaned = cleanAmount(val);
    if (onChangeText) {
      onChangeText(cleaned);
    }
  };

  const handleAmountBlur = e => {
    setIsFocused(false);

    // Format the value when user leaves the field
    if (value) {
      const formatted = formatAmount(value);
      if (onChangeText) {
        onChangeText(formatted);
      }
    }

    if (onBlur) {
      onBlur(e);
    }
  };

  const handleAmountFocus = () => {
    setIsFocused(true);

    // Remove formatting when user focuses (remove commas)
    if (value) {
      const unformatted = value.replace(/,/g, '');
      if (onChangeText) {
        onChangeText(unformatted);
      }
    }
  };

  const handlePhoneChange = text => {
    // Clean input - only allow digits
    const cleaned = text.replace(/\D/g, '');

    // Prevent typing beyond 10 digits
    if (cleaned.length > 10) {
      return;
    }

    // Update display value (this will be auto-formatted)
    setDisplayPhone(cleaned);

    // Convert to storage format: 9XXXXXXXXX -> 639XXXXXXXXX
    let storageValue = '';
    if (cleaned.length > 0) {
      // Add 63 prefix
      storageValue = '63' + cleaned;
    }

    // Real-time validation
    const validationError = validatePhilippineNumber(cleaned);
    setPhoneError(validationError);

    // Notify parent of validation state
    const isValid =
      !validationError && cleaned.length === 10 && cleaned.startsWith('9');
    if (onValidationChange) {
      onValidationChange(isValid);
    }

    // Pass storage format to parent (639XXXXXXXXX)
    if (onChangeText) {
      onChangeText(storageValue);
    }
  };

  const handlePhoneBlur = () => {
    if (displayPhone) {
      const validationError = validatePhilippineNumber(displayPhone);
      setPhoneError(validationError);

      const isValid =
        !validationError &&
        displayPhone.length === 10 &&
        displayPhone.startsWith('9');
      if (onValidationChange) {
        onValidationChange(isValid);
      }
    }

    if (onBlur) {
      onBlur();
    }
  };

  const handlePhoneFocus = () => {
    setPhoneError(null);
  };

  // Display value: show raw while typing, formatted when not focused
  const displayValue = isAmount
    ? isFocused
      ? value
      : value
      ? formatAmount(value)
      : ''
    : value;

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, labelColor && { color: labelColor }]}>
          {label}
        </Text>
      )}

      {isPhone ? (
        <View
          style={[
            styles.phoneContainer,
            (error || phoneError) && styles.inputError,
          ]}>
          {/* PH Flag Emoji */}
          <Text style={styles.flagEmoji}>🇵🇭</Text>

          {/* Country Code */}
          <Text style={styles.countryCode}>+63</Text>

          {/* Phone Input - Auto-formatted display */}
          <TextInput
            value={formatPhoneDisplay(displayPhone)}
            onChangeText={handlePhoneChange}
            onBlur={handlePhoneBlur}
            onFocus={handlePhoneFocus}
            placeholder={placeholder || '9XX-XXX-XXXX'}
            placeholderTextColor={colors.darkGrey}
            style={styles.phoneInput}
            keyboardType="phone-pad"
          />
        </View>
      ) : (
        <TextInput
          value={displayValue}
          onChangeText={isAmount ? handleAmountChange : onChangeText}
          onBlur={isAmount ? handleAmountBlur : onBlur}
          onFocus={isAmount ? handleAmountFocus : undefined}
          placeholder={placeholder}
          placeholderTextColor={colors.darkGrey}
          style={[
            isComment ? styles.commentBox : styles.input,
            error && styles.inputError,
          ]}
          keyboardType={isAmount ? 'decimal-pad' : 'default'}
          multiline={isComment}
          numberOfLines={isComment ? 4 : 1}
          textAlignVertical={isComment ? 'top' : 'center'}
        />
      )}

      {(error || phoneError) && (
        <AppTextError>{error || phoneError}</AppTextError>
      )}
    </View>
  );
};

export default AppTextInput;

const getStyles = ({ colors, look }) =>
  StyleSheet.create({
    container: {
      marginBottom: 18,
    },
    label: {
      fontFamily: 'Poppins Medium',
      fontSize: 13,
      lineHeight: 18,
      color: look.muted,
      marginBottom: 6,
    },
    // A field is a quiet filled box with a hairline around it.
    input: {
      minHeight: 52,
      borderWidth: 1,
      borderColor: look.hairline,
      borderRadius: 14,
      backgroundColor: look.soft,
      color: look.text,
      fontFamily: 'Poppins Regular',
      fontSize: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    inputError: {
      borderColor: colors.error,
    },
    disabledInput: {
      opacity: 0.6,
    },
    phoneContainer: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: look.hairline,
      borderRadius: 14,
      backgroundColor: look.soft,
      paddingHorizontal: 14,
    },
    flagEmoji: {
      fontSize: 20,
      marginRight: 8,
    },
    countryCode: {
      fontFamily: 'Poppins Medium',
      fontSize: 16,
      color: look.text,
      marginRight: 10,
    },
    phoneInput: {
      flex: 1,
      fontFamily: 'Poppins Regular',
      fontSize: 16,
      color: look.text,
      paddingVertical: 10,
      paddingHorizontal: 0,
    },
    commentBox: {
      minHeight: 100,
      borderWidth: 1,
      borderColor: look.hairline,
      borderRadius: 14,
      backgroundColor: look.soft,
      color: look.text,
      fontFamily: 'Poppins Regular',
      fontSize: 16,
      padding: 14,
    },
  });
