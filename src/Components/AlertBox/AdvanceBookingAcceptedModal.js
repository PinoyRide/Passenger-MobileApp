import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { AppButton } from '@/Components';
import { DEFAULT_PASSENGER_CANCELLATION_NOTICE } from '@/Hooks/useBookLaterConfig';

const NoticeBlock = ({ text, style, boldStyle }) => {
  const full = text || DEFAULT_PASSENGER_CANCELLATION_NOTICE;
  const match = full.match(/^(Notice:\s*)(.*)$/i);
  if (!match) {
    return <Text style={style}>{full}</Text>;
  }
  return (
    <Text style={style}>
      <Text style={boldStyle}>{match[1]}</Text>
      {match[2]}
    </Text>
  );
};

const AdvanceBookingAcceptedModal = ({
  visible,
  onClose,
  riderName,
  plateNumber,
  vehicleLabel,
  imageSource,
  dateText,
  timeText,
  pickup,
  dropoff,
  noticeText,
}) => {
  const { colors } = useTheme();
  const styles = getStyles({ colors });

  if (!visible) {
    return null;
  }

  const displayVehicle = (vehicleLabel || '').toUpperCase();

  return (
    <Pressable style={styles.backdrop} onPress={onClose}>
      <Pressable style={styles.card} onPress={e => e.stopPropagation()}>
        <Text style={styles.title}>Congratulations</Text>
        <Text style={styles.subtitle}>Booking Accepted</Text>

        <View style={styles.riderRow}>
          <View style={styles.avatarRing}>
            <Image
              source={imageSource}
              style={styles.avatar}
              resizeMode="cover"
            />
          </View>
          <View style={styles.riderTextBlock}>
            <Text style={styles.riderName}>{riderName}</Text>
            <Text style={styles.plateNumber}>{plateNumber}</Text>
            <Text style={styles.vehicle}>{displayVehicle}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <DetailRow label="Date" value={dateText} colors={colors} />
        <DetailRow label="Time" value={timeText} colors={colors} />
        <DetailRow label="Pick Up" value={pickup} colors={colors} />
        <DetailRow label="Drop off" value={dropoff} colors={colors} />

        <View style={styles.divider} />

        <NoticeBlock
          text={noticeText}
          style={styles.notice}
          boldStyle={styles.noticeBold}
        />

        <AppButton
          title="Okay"
          onPress={onClose}
          isBold
          noSpacing
          featureStyle={styles.okayButton}
        />
      </Pressable>
    </Pressable>
  );
};

const DetailRow = ({ label, value, colors }) => (
  <View style={stylesRow.row}>
    <Text style={[stylesRow.label, { color: colors.grey3 ?? '#7C7C7C' }]}>
      {label}
    </Text>
    <Text
      style={[stylesRow.value, { color: colors.textDark ?? '#263238' }]}
      numberOfLines={1}>
      {value}
    </Text>
  </View>
);

const stylesRow = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 35,
    marginBottom: 8,
    minHeight: 25,
  },
  label: {
    fontFamily: 'Poppins Regular',
    fontSize: 14,
  },
  value: {
    fontFamily: 'Poppins Regular',
    fontSize: 14,
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
});

export default AdvanceBookingAcceptedModal;

const getStyles = ({ colors }) =>
  StyleSheet.create({
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 25,
    },
    card: {
      width: 321,
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      paddingTop: 35,
      paddingBottom: 30,
      alignItems: 'center',
    },
    title: {
      fontSize: 16,
      fontFamily: 'Poppins SemiBold',
      color: '#000000',
    },
    subtitle: {
      fontSize: 16,
      fontFamily: 'Poppins Regular',
      color: '#000000',
      marginTop: 4,
      marginBottom: 18,
    },
    riderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 17.5,
      paddingHorizontal: 28,
    },
    avatarRing: {
      width: 77,
      height: 77,
      borderRadius: 38.5,
      borderWidth: 2,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 27.5,
    },
    avatar: {
      width: 73,
      height: 73,
      borderRadius: 36.5,
    },
    riderTextBlock: {
      flex: 1,
    },
    riderName: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 14,
      color: '#000000',
    },
    plateNumber: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 14,
      color: '#000000',
      marginTop: 4,
    },
    vehicle: {
      fontFamily: 'Poppins Regular',
      fontSize: 12,
      color: '#000000',
      marginTop: 4,
    },
    divider: {
      height: 1,
      backgroundColor: colors.grey ?? '#D9D9D9',
      alignSelf: 'stretch',
      marginHorizontal: 19,
      marginVertical: 8,
    },
    notice: {
      fontFamily: 'Poppins Regular',
      fontSize: 12,
      lineHeight: 18,
      color: colors.textDark ?? '#263238',
      alignSelf: 'stretch',
      paddingHorizontal: 28,
      marginTop: 8,
      marginBottom: 14,
    },
    noticeBold: {
      fontFamily: 'Poppins SemiBold',
    },
    okayButton: {
      width: 266,
      height: 47,
      borderRadius: 23.5,
      elevation: 0,
      shadowOpacity: 0,
      marginTop: 0,
    },
  });
