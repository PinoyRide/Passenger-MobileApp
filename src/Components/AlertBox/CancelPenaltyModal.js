import React from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon } from 'react-native-paper';
import { ON_PRIMARY_BUTTON_TEXT } from '@/Theme';
import {
  CANCEL_FREE_BODY,
  cancelWithPenaltyBody,
} from '@/Utils/cancellationPolicy';

const formatPeso = amount => {
  const n = Number(amount);
  if (amount == null || amount === '' || !Number.isFinite(n)) {
    return '';
  }
  return `₱${n.toFixed(2)}`;
};

// Figma "Frame 2" (node 296-3522).
const CancelPenaltyModal = ({
  visible,
  penaltyAmount,
  prettyPenaltyAmount,
  penaltyApplies = true,
  penaltyPercent,
  onYes,
  onNo,
  loading = false,
}) => {
  const amountText = prettyPenaltyAmount || formatPeso(penaltyAmount);
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onNo}>
      <View style={styles.overlay}>
        <View style={styles.card} testID="cancel-penalty-modal">
          <Icon source="cancel" size={56} color="#FFC107" />
          <Text style={styles.title}>
            {penaltyApplies
              ? 'Cancel Booking with Penalty?'
              : 'Cancel Booking?'}
          </Text>
          <Text style={styles.body}>
            {penaltyApplies
              ? cancelWithPenaltyBody(penaltyPercent)
              : CANCEL_FREE_BODY}
          </Text>
          {penaltyApplies && amountText ? (
            <Text style={styles.amount}>Penalty: {amountText}</Text>
          ) : null}
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.pill, styles.yes]}
              disabled={loading}
              onPress={onYes}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.yesText}>Yes</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pill, styles.no]}
              disabled={loading}
              onPress={onNo}>
              <Text style={styles.noText}>No</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default CancelPenaltyModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: 330,
    maxWidth: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Poppins SemiBold',
    fontWeight: '600',
    fontSize: 19,
    color: '#444444',
    textAlign: 'center',
    marginTop: 12,
  },
  body: {
    fontFamily: 'Poppins Regular',
    fontSize: 14,
    lineHeight: 21,
    color: '#7C7C7C',
    textAlign: 'center',
    marginTop: 8,
  },
  amount: {
    fontFamily: 'Poppins Medium',
    fontSize: 15,
    color: '#444444',
    marginTop: 10,
  },
  row: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginTop: 18,
    gap: 12,
  },
  pill: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yes: { backgroundColor: '#FFC107' },
  no: { backgroundColor: '#FFE08A' },
  yesText: {
    fontFamily: 'Poppins Medium',
    fontSize: 15,
    color: ON_PRIMARY_BUTTON_TEXT,
  },
  noText: { fontFamily: 'Poppins Medium', fontSize: 15, color: '#5A4A00' },
});
