import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Container from '@/Components/Container/Container';
import usePostRequest from '@/Services/Api';
import useApiRequest from '@/Services/ApiV2';
import { Constants as AppConstants, AppUtil } from '@/Utils';
import { modern } from '@/Theme/modern';
import { selectUserInfo } from '@/Redux/Slices/userSlice';
import TransactionRow, { EmptyTransactions } from './TransactionRow';
import appAlert from '@/Utils/appAlert';
import { walletStampIsNew } from '@/Utils/cashOut';

// The note under "Activate your wallet": that the identity check is optional
// and nothing waits for it (a passed check only shows ACTIVE; cash in, pay
// and cash out work without it). It used to promise "RideRewards", which do
// not exist (Q-WALLET-TEXT: the team's wording O-2, chosen by the owner in
// A-199 and shipped by A-217).
const ACTIVATE_NOTE =
  'Optional. Check your ID once. Your wallet works either way.';

// The Wallet page, as the owner's design draws it (2026-11-22): the balance
// and whether the wallet is active, Cash in / Cash out, activating the
// wallet, and the latest transactions. Activating is the PayCools identity
// check, opened in the browser; until PayCools is switched on the server says
// it is not available yet. Nothing requires an active wallet yet. There is no
// sending money to another person (the owner, 2026-11-23: "remove"; PayCools
// has no sending between people either).
const WalletScreen = () => {
  const look = modern(useTheme());
  const styles = getStyles(look);
  const navigation = useNavigation();
  const route = useRoute();
  const userInfo = useSelector(selectUserInfo);
  const walletRequest = useApiRequest();
  const ekycRequest = usePostRequest();
  const [wallet, setWallet] = useState(null);
  const [starting, setStarting] = useState(false);

  // The page's read (in a ref, so the focus, the stamp and the pull always
  // call the latest one). `showing` is false once the page has gone.
  const showing = useRef(true);
  const loadRef = useRef(async () => {});
  loadRef.current = async () => {
    if (!userInfo?.id) {
      return;
    }
    const { response } = await walletRequest.request(
      'GET',
      AppConstants.API.CUSTOMER_WALLET(userInfo.id),
    );
    if (showing.current && response?.data) {
      setWallet(response.data);
    }
  };

  // read again each time the page shows: after a top-up, or after the
  // identity check in the browser
  useFocusEffect(
    useCallback(() => {
      showing.current = true;
      loadRef.current();
      return () => {
        showing.current = false;
      };
      // a new sign-in reads again
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userInfo?.id]),
  );

  // ... and when a money notification stamps it while it is already on
  // screen (View in its box, or the push itself): the page stays focused, so
  // the focus read above does not run (WAL-11, 2026-11-26)
  const stamp = route.params?.walletRefreshAt;
  const seenStamp = useRef(stamp);
  useEffect(() => {
    if (walletStampIsNew(seenStamp.current, stamp)) {
      seenStamp.current = stamp;
      loadRef.current();
    }
  }, [stamp]);

  // pull down to read again
  const [pulling, setPulling] = useState(false);
  const pull = async () => {
    setPulling(true);
    try {
      await loadRef.current();
    } finally {
      setPulling(false);
    }
  };

  const balance =
    wallet?.availBalance ?? userInfo?.wallet_details?.avail_balance ?? 0;
  // what can be cashed out: money added by Pinoy Ride pays for rides only
  const cashable = wallet?.cashableBalance;
  const active = Boolean(wallet?.active);
  const transactions = wallet?.transactions ?? [];

  const activate = async () => {
    setStarting(true);
    const { response, error } = await ekycRequest.makePostRequest(
      AppConstants.ENDPOINT.GET_EKYC_URL,
      {},
    );
    setStarting(false);
    const url = response?.data?.ekyc_url || response?.data?.zkyc_url;
    if (url) {
      Linking.openURL(url).catch(() =>
        appAlert(
          'Activate your wallet',
          'The identity check could not be opened. Please try again.',
        ),
      );
      return;
    }
    appAlert(
      'Activate your wallet',
      error ||
        response?.message ||
        'Identity verification is not available yet. Please try again later.',
    );
  };

  const actions = [
    {
      id: 'cash-in',
      label: 'Cash in',
      icon: 'plus',
      gold: true,
      onPress: () =>
        navigation.navigate('CashInScreen', { available_balance: balance }),
    },
    // Cash out (the owner, 2026-11-23: "since they can cash in they can also
    // cash out"): through PayCools to any e-wallet or bank it pays out to, at
    // most the cashable part; it needs the sign-in token
    {
      id: 'cash-out',
      label: 'Cash out',
      icon: 'bank-transfer-out',
      onPress: () =>
        navigation.navigate('CashOutScreen', {
          walletDetails: { avail_balance: balance, cashable_balance: cashable },
          fromLabel: 'PinoyRide Wallet',
        }),
    },
  ];

  return (
    <Container style={styles.container} background={look.page}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={8}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Back">
          <Icon name="chevron-left" size={28} color={look.ink} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          Wallet
        </Text>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={pull}
            colors={[look.muted]}
            tintColor={look.muted}
            progressBackgroundColor={look.card}
          />
        }>
        <View style={styles.balanceCard}>
          <View style={styles.balanceTop}>
            <View style={styles.flex}>
              <Text style={styles.balanceLabel}>AVAILABLE BALANCE</Text>
              <Text
                style={styles.balance}
                numberOfLines={1}
                adjustsFontSizeToFit
                maxFontSizeMultiplier={1.2}>
                ₱{AppUtil.fn(balance)}
              </Text>
            </View>
            <View style={styles.walletTile}>
              <Icon name="wallet-outline" size={21} color={look.onGold} />
            </View>
          </View>
          <View style={styles.balanceBottom}>
            <Text style={styles.walletName}>PinoyRide Wallet</Text>
            <View style={styles.status}>
              <Text style={styles.statusText}>
                {active ? 'ACTIVE' : 'NOT ACTIVATED'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          {actions.map(action => (
            <Pressable
              key={action.id}
              onPress={action.onPress}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              style={({ pressed }) => [
                styles.action,
                pressed && styles.pressed,
              ]}>
              <View
                style={[styles.actionTile, action.gold && styles.actionGold]}>
                <Icon
                  name={action.icon}
                  size={19}
                  color={action.gold ? look.chipInk : look.inkSoft}
                />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </View>

        {active ? null : (
          <Pressable
            onPress={activate}
            disabled={starting}
            accessibilityRole="button"
            accessibilityLabel="Activate your wallet"
            accessibilityHint={ACTIVATE_NOTE}
            accessibilityState={{ busy: starting }}
            style={({ pressed }) => [
              styles.activate,
              pressed && styles.pressed,
            ]}>
            <View style={styles.activateTile}>
              <Icon name="shield-check-outline" size={20} color={look.onGold} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.activateTitle}>Activate your wallet</Text>
              <Text style={styles.activateNote}>{ACTIVATE_NOTE}</Text>
            </View>
            {starting ? (
              <ActivityIndicator color={look.muted} />
            ) : (
              <Icon name="chevron-right" size={20} color={look.faint} />
            )}
          </Pressable>
        )}

        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel} accessibilityRole="header">
            TRANSACTIONS
          </Text>
          <Pressable
            onPress={() => navigation.navigate('WalletTransactionsScreen')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="See all transactions">
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.listCard,
            transactions.length === 0 && styles.listCardEmpty,
          ]}>
          {transactions.length === 0 ? (
            <EmptyTransactions look={look} />
          ) : (
            transactions.map((item, index) => (
              <TransactionRow
                key={item.id}
                item={item}
                look={look}
                divided={index > 0}
              />
            ))
          )}
        </View>
      </ScrollView>
    </Container>
  );
};

export default WalletScreen;

const getStyles = look =>
  StyleSheet.create({
    // Container keeps 20 at each side; the design's cards sit 16 from the edge
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
    // the list itself is 4 wider at each side: a ScrollView cuts off whatever
    // its content pushes past its edges (WALLET-CLIP)
    scrollArea: { marginHorizontal: -4 },
    scroll: { flexGrow: 1, paddingBottom: 16 },
    flex: { flex: 1 },
    pressed: { opacity: 0.85 },
    balanceCard: {
      minHeight: 148,
      padding: 20,
      borderRadius: 24,
      backgroundColor: look.gold,
    },
    balanceTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    balanceLabel: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 11.5,
      lineHeight: 15,
      letterSpacing: 1.2,
      color: look.onGoldSoft,
    },
    balance: {
      marginTop: 6,
      fontFamily: 'Poppins SemiBold',
      fontSize: 40,
      lineHeight: 46,
      letterSpacing: -1,
      color: look.onGold,
    },
    walletTile: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: look.goldShade,
    },
    balanceBottom: {
      marginTop: 'auto',
      paddingTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    walletName: {
      fontFamily: 'Poppins Medium',
      fontSize: 14,
      lineHeight: 20,
      color: look.onGold,
    },
    status: {
      height: 24,
      paddingHorizontal: 10,
      borderRadius: 8,
      justifyContent: 'center',
      backgroundColor: look.goldShade,
    },
    statusText: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 11,
      lineHeight: 14,
      letterSpacing: 0.8,
      color: look.onGold,
    },
    actions: { marginTop: 18, flexDirection: 'row', gap: 11 },
    action: {
      flex: 1,
      minHeight: 83,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 12,
      borderRadius: 18,
      backgroundColor: look.card,
    },
    actionTile: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: look.tile,
    },
    actionGold: { backgroundColor: look.chip },
    actionLabel: {
      fontFamily: 'Poppins Medium',
      fontSize: 14,
      lineHeight: 19,
      color: look.ink,
    },
    activate: {
      marginTop: 15,
      minHeight: 86,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 16,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: look.gold,
      backgroundColor: look.card,
    },
    activateTile: {
      width: 38,
      height: 38,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: look.gold,
    },
    activateTitle: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 15,
      lineHeight: 21,
      color: look.ink,
    },
    activateNote: {
      marginTop: 1,
      fontFamily: 'Poppins Regular',
      fontSize: 13,
      lineHeight: 18,
      color: look.muted,
    },
    sectionRow: {
      marginTop: 26,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 2,
    },
    sectionLabel: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 11.5,
      lineHeight: 15,
      letterSpacing: 1.2,
      color: look.muted,
    },
    seeAll: {
      fontFamily: 'Poppins Medium',
      fontSize: 14,
      lineHeight: 19,
      color: look.link,
    },
    listCard: {
      borderRadius: look.radiusCard,
      backgroundColor: look.card,
      overflow: 'hidden',
    },
    listCardEmpty: { flexGrow: 1, minHeight: 300 },
  });
