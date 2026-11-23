import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { AlertBox, AppButton, AppTextInput, Container } from '@/Components';
import usePostRequest from '@/Services/Api';
import { Constants } from '@/Utils';
import { selectUserInfo } from '@/Redux/Slices/userSlice';
import { bottomSpace } from '@/Utils/bottomSpace';
import {
  CASH_OUT_TIMEOUT_MS,
  GCASH,
  MINIMUM_CASH_OUT,
  accountError,
  accountName,
  accountNameError,
  afterCashOut,
  cashOutRequest,
  channelsFrom,
  freshChannel,
  markLetter,
  maskedAccount,
} from '@/Utils/cashOut';
import { modern } from '@/Theme/modern';

const MINIMUM = MINIMUM_CASH_OUT;

const pesos = value =>
  `₱${Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// A channel's logo (the company's own icon, served by the API), or a lettered
// tile when it has none or it does not load.
const ChannelMark = ({ channel, size }) => {
  const look = modern(useTheme());
  const [failed, setFailed] = useState(null);
  const box = {
    width: size,
    height: size,
    borderRadius: Math.round(size * 0.28),
  };
  if (channel?.logo && failed !== channel.logo) {
    return (
      <Image
        source={{ uri: channel.logo }}
        onError={() => setFailed(channel.logo)}
        style={[box, { borderWidth: 1, borderColor: look.hairline }]}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View
      style={[
        box,
        {
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: look.tile,
        },
      ]}>
      <Text
        style={{
          fontFamily: 'Poppins SemiBold',
          fontSize: Math.round(size * 0.46),
          lineHeight: Math.round(size * 0.62),
          color: look.inkSoft,
        }}>
        {markLetter(channel?.name)}
      </Text>
    </View>
  );
};

// Cash out, the same page in both apps (sharedUi.test.mjs): to any e-wallet
// or bank PayCools pays out to (the owner, 2026-11-23: "are we not using
// paycool?", "same with rider"). At most the cashable part of the wallet:
// money added by Pinoy Ride can be used in the app but not cashed out. The
// opener passes walletDetails ({ avail_balance, cashable_balance }) and
// fromLabel, what the app calls the wallet.
const CashOutScreen = ({ route }) => {
  const look = modern(useTheme());
  const styles = getStyles(look);
  const navigation = useNavigation();
  const { bottom } = useSafeAreaInsets();
  const userInfo = useSelector(selectUserInfo);
  const walletDetails = route?.params?.walletDetails;
  const fromLabel = route?.params?.fromLabel || 'Your wallet';

  const total = Number(walletDetails?.avail_balance) || 0;
  const cashableRaw = walletDetails?.cashable_balance;
  const available =
    cashableRaw !== undefined && cashableRaw !== null
      ? Math.max(0, Number(cashableRaw) || 0)
      : Math.max(0, total);
  const notCashable = Math.max(0, total - available);

  const firstName =
    userInfo?.ekyc_details?.first_name ||
    userInfo?.first_name ||
    userInfo?.fname;
  const lastName =
    userInfo?.ekyc_details?.last_name || userInfo?.last_name || userInfo?.lname;

  const [kind, setKind] = useState('ewallet'); // 'ewallet' | 'bank'
  const [channel, setChannel] = useState(GCASH);
  const [account, setAccount] = useState('');
  const [name, setName] = useState(() => accountName(firstName, lastName));
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertVisible, setAlertVisible] = useState(false);

  const banksRequest = usePostRequest();
  const cashOut = usePostRequest();
  const [channels, setChannels] = useState({ ewallets: [GCASH], banks: [] });
  const [listIn, setListIn] = useState(false);
  useEffect(() => {
    let active = true;
    (async () => {
      const answer = await banksRequest.makePostRequest(
        Constants.ENDPOINT.GET_BANKS,
        {},
      );
      if (!active) {
        return;
      }
      const got = channelsFrom(answer?.response?.data);
      if (got.ewallets.length || got.banks.length) {
        const next = {
          ewallets: got.ewallets.length ? got.ewallets : [GCASH],
          banks: got.banks,
        };
        setChannels(next);
        setChannel(current => freshChannel(next, current));
      }
      setListIn(true);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = parseFloat(String(amount).replace(/,/g, '')) || 0;

  const chooseKind = next => {
    if (next === kind) {
      return;
    }
    setKind(next);
    setChannel(next === 'bank' ? null : channels.ewallets[0] || GCASH);
    setAccount('');
    setErrors({});
  };

  const filteredBanks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? channels.banks.filter(
          b =>
            b.name.toLowerCase().includes(q) ||
            b.code.toLowerCase().includes(q),
        )
      : channels.banks;
  }, [channels.banks, search]);

  const check = () => {
    const next = {};
    if (!(value > 0)) {
      next.amount = 'Enter the amount';
    } else if (value < MINIMUM) {
      next.amount = `The minimum cash out is ${pesos(MINIMUM)}`;
    } else if (value > available) {
      next.amount = `You can cash out up to ${pesos(available)}`;
    }
    if (!channel) {
      next.channel = 'Choose your bank';
    } else {
      const problem = accountError(channel, account);
      if (problem) {
        next.account = problem;
      }
    }
    const nameProblem = accountNameError(name);
    if (nameProblem) {
      next.name = nameProblem;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleNext = () => {
    Keyboard.dismiss();
    if (check()) {
      setConfirming(true);
    }
  };

  // Sent once; "done" only when the backend says PayCools has the order.
  // One cash-out per press: the loading state lets a quick second tap
  // through (overnight review 2026-11-23).
  const sendingRef = useRef(false);
  const handleSubmit = async () => {
    if (cashOut.loading || sendingRef.current) {
      return;
    }
    sendingRef.current = true;
    let answer;
    try {
      answer = await cashOut.makePostRequest(
        Constants.ENDPOINT.CASH_OUT,
        cashOutRequest({ amount: value, channel, account, name }),
        { timeout: CASH_OUT_TIMEOUT_MS },
        'json',
      );
    } finally {
      sendingRef.current = false;
    }
    const next = afterCashOut(answer, value);
    if (next.refusal) {
      setAlertMessage(next.refusal);
      setAlertVisible(true);
      return;
    }
    if (next.complete) {
      navigation.navigate('AppTransactionComplete', {
        referenceData: {
          amount: next.complete.amount,
          transactionType: 'CASHOUT',
          status: next.complete.status,
          transactionId: next.complete.reference,
        },
      });
    }
  };

  const back = () => (confirming ? setConfirming(false) : navigation.goBack());

  const row = (label, text) => (
    <View style={styles.confirmRow} key={label}>
      <Text style={styles.confirmLabel}>{label}</Text>
      <Text style={styles.confirmValue} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );

  return (
    <Container style={styles.container} background={look.page}>
      <View style={styles.header}>
        <Pressable
          onPress={back}
          hitSlop={8}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Back">
          <Icon name="chevron-left" size={28} color={look.ink} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {confirming ? 'Check and send' : 'Cash out'}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.availableCard}>
          <Text style={styles.availableLabel}>AVAILABLE TO CASH OUT</Text>
          <Text style={styles.availableAmount}>{pesos(available)}</Text>
          {notCashable > 0 ? (
            <Text style={styles.availableNote}>
              {pesos(notCashable)} of your balance was added by Pinoy Ride. It
              can be used in the app but cannot be cashed out.
            </Text>
          ) : null}
        </View>

        {confirming ? (
          <View style={styles.card}>
            <View style={styles.confirmRow}>
              <Text style={styles.confirmLabel}>Send to</Text>
              <View style={styles.confirmChannel}>
                <ChannelMark channel={channel} size={22} />
                <Text style={styles.confirmValue} numberOfLines={1}>
                  {channel?.name}
                </Text>
              </View>
            </View>
            {row(
              channel?.isBank ? 'Account number' : 'Mobile number',
              maskedAccount(channel, account),
            )}
            {row('Account name', name.trim())}
            {row('From', fromLabel)}
            <View style={styles.confirmTotal}>
              <Text style={styles.confirmTotalLabel}>Amount</Text>
              <Text style={styles.confirmTotalValue}>{pesos(value)}</Text>
            </View>
            <Text style={styles.confirmNote}>
              Check the account before you send: money sent to a wrong account
              may not come back.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionLabel}>SEND TO</Text>
            <View style={styles.tabs} accessibilityRole="tablist">
              {[
                ['ewallet', 'E-wallet'],
                ['bank', 'Bank'],
              ].map(([key, label]) => {
                const on = kind === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => chooseKind(key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    style={[styles.tab, on && styles.tabOn]}>
                    <Text style={[styles.tabText, on && styles.tabTextOn]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {kind === 'ewallet' && !listIn ? (
              <ActivityIndicator
                style={styles.chipsLoading}
                color={look.muted}
              />
            ) : kind === 'ewallet' ? (
              <View style={styles.chips}>
                {channels.ewallets.map(e => {
                  const on = channel?.code === e.code;
                  return (
                    <Pressable
                      key={e.code}
                      onPress={() => setChannel(e)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      style={[styles.chip, on && styles.chipOn]}>
                      <ChannelMark channel={e} size={22} />
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>
                        {e.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View style={styles.bankField}>
                <Pressable
                  onPress={() => setPicking(true)}
                  accessibilityRole="button"
                  style={[
                    styles.bankButton,
                    errors.channel && styles.bankButtonError,
                  ]}>
                  {channel ? (
                    <ChannelMark channel={channel} size={28} />
                  ) : (
                    <Icon name="bank-outline" size={20} color={look.chipInk} />
                  )}
                  <Text
                    style={[styles.bankText, !channel && styles.bankHint]}
                    numberOfLines={1}>
                    {channel ? channel.name : 'Choose your bank'}
                  </Text>
                  <Icon name="chevron-down" size={20} color={look.muted} />
                </Pressable>
                {errors.channel ? (
                  <Text style={styles.error}>{errors.channel}</Text>
                ) : null}
              </View>
            )}

            <AppTextInput
              label={kind === 'bank' ? 'Account number' : 'Mobile number'}
              value={account}
              onChangeText={text => {
                setAccount(text);
                if (errors.account) {
                  setErrors(e => ({ ...e, account: '' }));
                }
              }}
              placeholder={kind === 'bank' ? 'Digits only' : '09XXXXXXXXX'}
              inputMode="numeric"
              error={errors.account}
            />
            <AppTextInput
              label="Account name"
              value={name}
              onChangeText={text => {
                setName(text);
                if (errors.name) {
                  setErrors(e => ({ ...e, name: '' }));
                }
              }}
              placeholder="As the account has it"
              autoCapitalize="words"
              error={errors.name}
            />
            <AppTextInput
              label="Amount"
              value={amount}
              onChangeText={text => {
                setAmount(text);
                if (errors.amount) {
                  setErrors(e => ({ ...e, amount: '' }));
                }
              }}
              placeholder="0.00"
              inputMode="amount"
              error={errors.amount}
            />
            <Text style={styles.hint}>The minimum is {pesos(MINIMUM)}.</Text>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {confirming ? (
          <>
            <AppButton
              title={cashOut.loading ? 'Sending…' : `Cash out ${pesos(value)}`}
              onPress={handleSubmit}
              disabled={cashOut.loading}
              isBold
              noSpacing
            />
            <View style={styles.footerGap} />
            <AppButton
              title="Change details"
              mode="outlined"
              onPress={() => setConfirming(false)}
              disabled={cashOut.loading}
              noSpacing
            />
          </>
        ) : (
          <AppButton
            title="Next"
            onPress={handleNext}
            disabled={available <= 0}
            isBold
            noSpacing
          />
        )}
      </View>

      <Modal
        visible={picking}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPicking(false)}>
        <View style={styles.backdrop}>
          <View
            style={[styles.sheet, { paddingBottom: bottomSpace(bottom, 16) }]}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Choose your bank</Text>
              <Pressable
                onPress={() => setPicking(false)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close">
                <Icon name="close" size={22} color={look.ink} />
              </Pressable>
            </View>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search banks"
              placeholderTextColor={look.muted}
              style={styles.search}
            />
            <FlatList
              data={filteredBanks}
              keyExtractor={b => b.code}
              keyboardShouldPersistTaps="handled"
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={
                <Text style={styles.empty}>
                  {channels.banks.length
                    ? 'No bank matches.'
                    : listIn
                    ? 'The banks could not be loaded. Please try again later.'
                    : 'Loading the banks…'}
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setChannel(item);
                    setPicking(false);
                    setSearch('');
                    setErrors(e => ({ ...e, channel: '' }));
                  }}
                  style={styles.bankRow}
                  accessibilityRole="button">
                  <ChannelMark channel={item} size={32} />
                  <Text style={styles.bankRowText}>{item.name}</Text>
                  {channel?.code === item.code ? (
                    <Icon name="check" size={20} color={look.chipInk} />
                  ) : null}
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>

      <AlertBox
        title="Cash out"
        confirmText="OK"
        message={alertMessage}
        visible={alertVisible}
        setVisible={setAlertVisible}
      />
    </Container>
  );
};

export default CashOutScreen;

const getStyles = look =>
  StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 0 },
    header: {
      height: 52,
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: -14,
      marginBottom: 6,
    },
    back: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      marginLeft: 10,
      fontFamily: 'Poppins SemiBold',
      fontSize: 20,
      lineHeight: 26,
      letterSpacing: -0.3,
      color: look.ink,
    },
    scrollArea: { marginHorizontal: -4 },
    scroll: { flexGrow: 1, paddingBottom: 16 },
    availableCard: {
      padding: 16,
      borderRadius: look.radiusCard,
      backgroundColor: look.gold,
    },
    availableLabel: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 11.5,
      lineHeight: 15,
      letterSpacing: 1.2,
      color: look.onGoldSoft,
    },
    availableAmount: {
      marginTop: 4,
      fontFamily: 'Poppins SemiBold',
      fontSize: 30,
      lineHeight: 38,
      letterSpacing: -0.7,
      color: look.onGold,
    },
    availableNote: {
      marginTop: 6,
      fontFamily: 'Poppins Regular',
      fontSize: 12.5,
      lineHeight: 17,
      color: look.onGoldSoft,
    },
    sectionLabel: {
      marginTop: 22,
      marginBottom: 10,
      fontFamily: 'Poppins SemiBold',
      fontSize: 11.5,
      lineHeight: 15,
      letterSpacing: 1.2,
      color: look.muted,
    },
    tabs: {
      flexDirection: 'row',
      padding: 4,
      borderRadius: 14,
      backgroundColor: look.tile,
    },
    tab: {
      flex: 1,
      height: 36,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabOn: {
      backgroundColor: look.card,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
      elevation: 2,
    },
    tabText: {
      fontFamily: 'Poppins Medium',
      fontSize: 14,
      lineHeight: 19,
      color: look.muted,
    },
    tabTextOn: { fontFamily: 'Poppins SemiBold', color: look.ink },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
      marginBottom: 16,
    },
    chipsLoading: { height: 36, marginTop: 12, marginBottom: 16 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingLeft: 6,
      paddingRight: 14,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: look.hairline,
      backgroundColor: look.card,
    },
    chipOn: { backgroundColor: look.chip, borderColor: look.chipInk },
    chipText: {
      fontFamily: 'Poppins Medium',
      fontSize: 13.5,
      lineHeight: 18,
      color: look.inkSoft,
    },
    chipTextOn: { fontFamily: 'Poppins SemiBold', color: look.chipInk },
    bankField: { marginTop: 12, marginBottom: 16 },
    bankButton: {
      height: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: look.hairline,
      backgroundColor: look.card,
    },
    bankButtonError: { borderColor: look.danger },
    bankText: {
      flex: 1,
      fontFamily: 'Poppins Medium',
      fontSize: 15,
      lineHeight: 20,
      color: look.ink,
    },
    bankHint: { color: look.muted, fontFamily: 'Poppins Regular' },
    error: {
      marginTop: 6,
      fontFamily: 'Poppins Regular',
      fontSize: 12,
      lineHeight: 16,
      color: look.danger,
    },
    hint: {
      marginTop: -8,
      fontFamily: 'Poppins Regular',
      fontSize: 12,
      lineHeight: 17,
      color: look.muted,
    },
    card: {
      marginTop: 12,
      padding: 16,
      borderRadius: look.radiusCard,
      backgroundColor: look.card,
    },
    confirmRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 6,
    },
    confirmLabel: {
      fontFamily: 'Poppins Regular',
      fontSize: 14,
      lineHeight: 20,
      color: look.inkSoft,
    },
    confirmValue: {
      flexShrink: 1,
      fontFamily: 'Poppins SemiBold',
      fontSize: 14,
      lineHeight: 20,
      color: look.ink,
    },
    confirmChannel: {
      flexShrink: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    confirmTotal: {
      marginTop: 8,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: look.hairline,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    confirmTotalLabel: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 15,
      lineHeight: 21,
      color: look.ink,
    },
    confirmTotalValue: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 22,
      lineHeight: 28,
      color: look.ink,
    },
    confirmNote: {
      marginTop: 12,
      fontFamily: 'Poppins Regular',
      fontSize: 12.5,
      lineHeight: 17,
      color: look.muted,
    },
    footer: { paddingTop: 12, paddingBottom: 12 },
    footerGap: { height: 10 },
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheet: {
      maxHeight: '80%',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 16,
      paddingTop: 16,
      backgroundColor: look.surface,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    sheetTitle: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 17,
      lineHeight: 23,
      color: look.ink,
    },
    search: {
      height: 44,
      paddingHorizontal: 14,
      borderRadius: 12,
      marginBottom: 8,
      fontFamily: 'Poppins Regular',
      fontSize: 14.5,
      color: look.ink,
      backgroundColor: look.soft,
    },
    separator: { height: 1, backgroundColor: look.hairline },
    bankRow: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
    },
    bankRowText: {
      flex: 1,
      fontFamily: 'Poppins Medium',
      fontSize: 14.5,
      lineHeight: 20,
      color: look.ink,
    },
    empty: {
      paddingVertical: 24,
      textAlign: 'center',
      fontFamily: 'Poppins Regular',
      fontSize: 13,
      lineHeight: 18,
      color: look.muted,
    },
  });
