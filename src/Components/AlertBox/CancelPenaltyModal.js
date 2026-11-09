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
import { cancelDialogState } from '@/Utils/cancellationDialog';

const formatPeso = amount => {
  const n = Number(amount);
  if (amount == null || amount === '' || !Number.isFinite(n)) {
    return '';
  }
  return `₱${n.toFixed(2)}`;
};

// Figma "Frame 2" (node 296-3522). One dialog: checking (preview loading),
// failed (neutral + Retry/Close), free, or with penalty.
const CancelPenaltyModal = ({
  visible,
  penaltyAmount,
  prettyPenaltyAmount,
  penaltyApplies = true,
  penaltyPercent,
  checking = false,
  failed = false,
  onYes,
  onNo,
  loading = false,
}) => {
  const amountText = prettyPenaltyAmount || formatPeso(penaltyAmount);
  const dialog = cancelDialogState({
    checking,
    failed,
    penaltyApplies,
    penaltyPercent,
  });
  const busy = loading || dialog.buttonsDisabled;
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onNo}>
      <View style={styles.overlay}>
        <View style={styles.card} testID="cancel-penalty-modal">
          <Icon source="cancel" size={56} color="#FFC107" />
          <Text style={styles.title}>{dialog.title}</Text>
          <Text style={styles.body}>{dialog.body}</Text>
          {dialog.showAmount && amountText ? (
            <Text style={styles.amount}>Penalty: {amountText}</Text>
          ) : null}
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.pill, styles.yes]}
              disabled={busy}
              onPress={onYes}>
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.yesText}>{dialog.yesLabel}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pill, styles.no]}
              disabled={busy}
              onPress={onNo}>
              <Text style={styles.noText}>{dialog.noLabel}</Text>
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
