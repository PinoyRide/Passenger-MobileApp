import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
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
import {
  OPEN_FAILED,
  STATUS_POLL_FOR_MS,
  STATUS_POLL_MS,
  canStartCheck,
  ekycCheckIsOver,
  ekycJustPassed,
  ekycPassed,
  ekycRefusal,
  ekycTile,
} from '@/Utils/ekycWallet';
import {
  actionLook,
  balanceLabel,
  lockedAlert,
  lockedMoneyLine,
  verifyOnArrival,
  walletLocked,
} from '@/Utils/walletLock';

// The Wallet page, as the owner's design draws it (2026-11-22): the balance
// and whether the wallet is active, Cash in / Cash out, activating the
// wallet, and the latest transactions. Activating is the PayCools identity
// check, opened in the browser; until PayCools is switched on the server says
// it is not available yet. While the server locks the wallet until the check
// passes (`locked`, WALLET-EKYC-LOCK, the owner A-325), Cash in and Cash out
// say "Verify your ID to use your wallet." and offer Verify ID, which starts
// the check; Verify ID on another screen opens this page with `verifyAt`,
// which starts it here (Utils/walletLock.js). There is no sending money to
// another person (the owner, 2026-11-23: "remove"; PayCools has no sending
// between people either).
const WalletScreen = () => {
  const look = modern(useTheme());
  const styles = getStyles(look);
  const navigation = useNavigation();
  const route = useRoute();
  const userInfo = useSelector(selectUserInfo);
  const walletRequest = useApiRequest();
  const ekycRequest = usePostRequest();
  const statusRequest = usePostRequest();
  const [wallet, setWallet] = useState(null);
  const [starting, setStarting] = useState(false);

  // The page's read (in a ref, so the focus, the stamp and the pull always
  // call the latest one). `showing` is false once the page has gone.
  const showing = useRef(true);
  // the last answer drawn, to tell when the wallet has just become active
  const walletRef = useRef(null);
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
      // the check passed while the page was open (back from the browser, or
      // a review decided): said once, in a notice that closes itself
      if (ekycJustPassed(walletRef.current, response.data)) {
        appAlert('Your wallet is active');
      }
      walletRef.current = response.data;
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

  // ... and when the app comes back to the front: the identity check runs in
  // the browser, and coming back from it does not focus the page again
  // (EKYC-HOTFIX: a passed check stayed NOT ACTIVATED until the page was left)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active' && showing.current) {
        loadRef.current();
      }
    });
    return () => subscription.remove();
  }, []);

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
  // ACTIVE once the identity check passed; the tile under the actions says
  // where the check stands (the API's `ekyc`; Utils/ekycWallet.js)
  const active = ekycPassed(wallet);
  const tile = ekycTile(wallet);
  // locked until the check passes: Cash in and Cash out ask to verify first
  const locked = walletLocked(wallet);
  const transactions = wallet?.transactions ?? [];
  // locked with money in it: one line that the money is safe (F3)
  const moneyLine = lockedMoneyLine(locked, balance);

  // While a check is being checked and the page is open, ask for its status
  // (every 5 s, for up to 2 min); once it is over, read the wallet again
  const checkingReference =
    tile?.kind === 'checking' ? wallet?.ekyc?.reference : null;
  useEffect(() => {
    if (!checkingReference) {
      return undefined;
    }
    const until = Date.now() + STATUS_POLL_FOR_MS;
    let asking = false;
    const timer = setInterval(async () => {
      if (Date.now() > until) {
        clearInterval(timer);
        return;
      }
      if (asking || !showing.current) {
        return;
      }
      asking = true;
      try {
        const { response } = await statusRequest.makePostRequest(
          AppConstants.ENDPOINT.EKYC_CHECK_STATUS,
          { request_user_id: checkingReference },
        );
        if (ekycCheckIsOver(response?.data?.status)) {
          clearInterval(timer);
          await loadRef.current();
        }
      } finally {
        asking = false;
      }
    }, STATUS_POLL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingReference]);

  const activate = async () => {
    // never a new check once the wallet is active (a failed retry would
    // lock it again), nor one the tile does not offer
    if (!canStartCheck(walletRef.current)) {
      return;
    }
    setStarting(true);
    const { response, error, reason } = await ekycRequest.makePostRequest(
      AppConstants.ENDPOINT.GET_EKYC_URL,
      {},
    );
    setStarting(false);
    const url = response?.data?.ekyc_url || response?.data?.zkyc_url;
    if (url) {
      Linking.openURL(url).catch(() => appAlert(...OPEN_FAILED));
      return;
    }
    // the words by the refusal's reason; the tries left change, so read again
    appAlert(...ekycRefusal(reason, error || response?.message, locked));
    loadRef.current();
  };

  // "Verify your ID to use your wallet.": Verify ID starts the check when one
  // can be started now; otherwise one OK and where the check stands
  const askToVerify = () => {
    const canStart = canStartCheck(wallet);
    appAlert(
      ...lockedAlert(canStart ? activate : null, {
        note: canStart ? undefined : tile?.note,
      }),
    );
  };

  // Verify ID on another screen (Cash in, the booking sheet, Payment
  // options): opened with a new `verifyAt`, start the check once the wallet
  // has been read, if one can be started; otherwise say where the check
  // stands in a notice that closes itself (the tap no longer lands on a page
  // where nothing happens; Q-UX-WALLET-LOCK-POLISH F4)
  const verifyStamp = route.params?.verifyAt;
  const seenVerify = useRef(null);
  useEffect(() => {
    if (!wallet || !walletStampIsNew(seenVerify.current, verifyStamp)) {
      return;
    }
    seenVerify.current = verifyStamp;
    const next = verifyOnArrival(canStartCheck(wallet), tile);
    if (next === 'start') {
      activate();
    } else if (next === 'tell') {
      appAlert(tile.title, tile.note);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifyStamp, wallet]);

  const actions = [
    {
      id: 'cash-in',
      label: 'Cash in',
      icon: 'plus',
      gold: true,
      onPress: () => {
        // not read yet: whether it is locked is not known, so read it
        // (Q-UX-WALLET-LOCK-POLISH F5)
        if (!wallet) {
          loadRef.current();
          return;
        }
        if (locked) {
          askToVerify();
          return;
        }
        navigation.navigate('CashInScreen', { available_balance: balance });
      },
    },
    // Cash out (the owner, 2026-11-23: "since they can cash in they can also
    // cash out"): through PayCools to any e-wallet or bank it pays out to, at
    // most the cashable part; it needs the sign-in token
    {
      id: 'cash-out',
      label: 'Cash out',
      icon: 'bank-transfer-out',
      onPress: () => {
        if (!wallet) {
          loadRef.current();
          return;
        }
        if (locked) {
          askToVerify();
          return;
        }
        navigation.navigate('CashOutScreen', {
          walletDetails: { avail_balance: balance, cashable_balance: cashable },
          fromLabel: 'PinoyRide Wallet',
        });
      },
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
              <Text style={styles.balanceLabel}>{balanceLabel(locked)}</Text>
              <Text
                style={styles.balance}
                numberOfLines={1}
                adjustsFontSizeToFit
                maxFontSizeMultiplier={1.2}>
                ₱{AppUtil.fn(balance)}
              </Text>
              {moneyLine ? (
                <Text style={styles.moneyLine} numberOfLines={2}>
                  {moneyLine}
                </Text>
              ) : null}
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
          {actions.map(action => {
            // locked: a lock, no gold, quiet words; a tap still asks to
            // verify (Q-UX-WALLET-LOCK-POLISH F1)
            const tileLook = actionLook(action, locked);
            return (
              <Pressable
                key={action.id}
                onPress={action.onPress}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                accessibilityHint={locked ? 'Verify your ID first' : undefined}
                style={({ pressed }) => [
                  styles.action,
                  pressed && styles.pressed,
                ]}>
                <View
                  style={[
                    styles.actionTile,
                    tileLook.gold && styles.actionGold,
                  ]}>
                  <Icon
                    name={tileLook.icon}
                    size={19}
                    color={tileLook.gold ? look.chipInk : look.inkSoft}
                  />
                </View>
                <Text
                  style={[
                    styles.actionLabel,
                    tileLook.muted && styles.actionLabelLocked,
                  ]}>
                  {action.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tile ? (
          <Pressable
            onPress={tile.canStart ? activate : undefined}
            disabled={!tile.canStart || starting}
            accessibilityRole={tile.canStart ? 'button' : 'text'}
            accessibilityLabel={tile.title}
            accessibilityHint={tile.note}
            accessibilityState={{ busy: starting }}
            style={({ pressed }) => [
              styles.activate,
              tile.kind !== 'none' && styles.activateQuiet,
              pressed && tile.canStart && styles.pressed,
            ]}>
            <View
              style={[
                styles.activateTile,
                tile.kind === 'checking' || tile.kind === 'review'
                  ? styles.activateTileChip
                  : tile.kind !== 'none' && styles.activateTileQuiet,
              ]}>
              <Icon
                name={tile.icon}
                size={20}
                color={
                  tile.kind === 'none'
                    ? look.onGold
                    : tile.kind === 'checking' || tile.kind === 'review'
                    ? look.chipInk
                    : look.inkSoft
                }
              />
            </View>
            <View style={styles.flex}>
              <Text style={styles.activateTitle}>{tile.title}</Text>
              <Text style={styles.activateNote}>{tile.note}</Text>
            </View>
            {starting ? (
              <ActivityIndicator color={look.muted} />
            ) : tile.tryAgain ? (
              <View style={styles.tryAgain}>
                <Text style={styles.tryAgainText}>Try again</Text>
              </View>
            ) : tile.canStart ? (
              <Icon name="chevron-right" size={20} color={look.faint} />
            ) : null}
          </Pressable>
        ) : null}

        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel} accessibilityRole="header">
            TRANSACTIONS
          </Text>
          <Pressable
            onPress={() =>
              navigation.navigate('WalletTransactionsScreen', { locked })
            }
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
            <EmptyTransactions look={look} locked={locked} />
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
    moneyLine: {
      marginTop: 4,
      fontFamily: 'Poppins Regular',
      fontSize: 13,
      lineHeight: 18,
      color: look.onGoldSoft,
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
    actionLabelLocked: { color: look.muted },
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
    activateQuiet: { borderColor: look.hairline },
    activateTileChip: { backgroundColor: look.chip },
    activateTileQuiet: { backgroundColor: look.tile },
    tryAgain: {
      height: 32,
      paddingHorizontal: 12,
      borderRadius: 16,
      justifyContent: 'center',
      backgroundColor: look.chip,
    },
    tryAgainText: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 13,
      lineHeight: 18,
      color: look.chipInk,
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
