import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AppUtil } from '@/Utils';
import { emptyTransactionsNote } from '@/Utils/walletLock';

// One line of the wallet's ledger, and what shows while there is none: the
// Wallet page and its "See all" (WalletTransactionsScreen). `look` is
// modern(theme).

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// "2026-11-22T13:40:00Z" -> "22 Nov 2026 · 9:40 PM", in the phone's time
export const formatWhen = value => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  const hour = d.getHours() % 12 || 12;
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const half = d.getHours() < 12 ? 'AM' : 'PM';
  return `${d.getDate()} ${
    MONTHS[d.getMonth()]
  } ${d.getFullYear()} · ${hour}:${minutes} ${half}`;
};

const TransactionRow = ({ item, look, divided }) => {
  const moneyIn = item?.type === 'credit';
  const what = item?.description || (moneyIn ? 'Money in' : 'Money out');
  const amount = `${moneyIn ? '+' : '−'}₱${AppUtil.fn(item?.amount ?? 0)}`;
  return (
    <View>
      {divided ? (
        <View style={[styles.divider, { backgroundColor: look.hairline }]} />
      ) : null}
      <View
        style={styles.row}
        accessible
        accessibilityLabel={`${what}, ${amount}, ${formatWhen(
          item?.createdAt,
        )}`}>
        <View
          style={[
            styles.tile,
            { backgroundColor: moneyIn ? look.onSuccess : look.tile },
          ]}>
          <Icon
            name={moneyIn ? 'arrow-bottom-left' : 'arrow-top-right'}
            size={18}
            color={moneyIn ? look.success : look.inkSoft}
          />
        </View>
        <View style={styles.words}>
          <Text style={[styles.what, { color: look.ink }]} numberOfLines={1}>
            {what}
          </Text>
          <Text style={[styles.when, { color: look.muted }]}>
            {formatWhen(item?.createdAt)}
          </Text>
        </View>
        <Text
          style={[styles.amount, { color: moneyIn ? look.success : look.ink }]}>
          {amount}
        </Text>
      </View>
    </View>
  );
};

// `locked`: the wallet waits for the ID check. Its rows still come (the server
// does not hold them back), so the note does not blame the lock for an empty
// list (Q-UX-WALLET-LOCK-POLISH F6).
export const EmptyTransactions = ({ look, locked }) => (
  <View style={styles.empty}>
    <View style={[styles.emptyTile, { backgroundColor: look.tile }]}>
      <Icon name="receipt-text-outline" size={24} color={look.muted} />
    </View>
    <Text style={[styles.emptyTitle, { color: look.ink }]}>
      No transactions yet
    </Text>
    <Text style={[styles.emptyNote, { color: look.muted }]}>
      {emptyTransactionsNote(locked)}
    </Text>
  </View>
);

export default TransactionRow;

// the hairline between two lines starts where the words do
const SIDE = 16;
const TILE = 36;
const GAP = 12;

const styles = StyleSheet.create({
  divider: { height: 1, marginLeft: SIDE + TILE + GAP },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
    minHeight: 64,
    paddingVertical: 12,
    paddingHorizontal: SIDE,
  },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  words: { flex: 1 },
  what: { fontFamily: 'Poppins Medium', fontSize: 14.5, lineHeight: 20 },
  when: { fontFamily: 'Poppins Regular', fontSize: 12, lineHeight: 17 },
  amount: { fontFamily: 'Poppins SemiBold', fontSize: 14.5, lineHeight: 20 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  emptyTile: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    marginTop: 16,
    fontFamily: 'Poppins SemiBold',
    fontSize: 15.5,
    lineHeight: 21,
    textAlign: 'center',
  },
  emptyNote: {
    marginTop: 6,
    maxWidth: 280,
    fontFamily: 'Poppins Regular',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
