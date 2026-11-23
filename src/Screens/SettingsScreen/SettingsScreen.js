import React, { useCallback, useEffect, useState } from 'react';
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { useTheme } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Container from '@/Components/Container/Container';
import ProfileAvatar from '@/Components/ProfileAvatar/ProfileAvatar';
import { MenuGroup, MenuRow } from '@/Components/Menu/Menu';
import SafetyGuideModal from '@/Components/SafetyGuide/SafetyGuideModal';
import usePostRequest from '@/Services/Api';
import useApiRequest from '@/Services/ApiV2';
import { Constants as AppConstants, AppUtil } from '@/Utils';
import { APP_BUILD } from '@/Utils/appBuild';
import { displayMobile, fullNameOf } from '@/Utils/personName';
import { genderOf } from '@/Utils/gender';
import { modern } from '@/Theme/modern';
import {
  markPromosSeen,
  selectSeenPromoIds,
  selectUserInfo,
} from '@/Redux/Slices/userSlice';
import appAlert from '@/Utils/appAlert';

// The Account page, opened by the profile button on the map, as the owner's
// design draws it (2026-11-22): who you are, the wallet, the ride pages,
// Settings and help, and help in an emergency. Log out is in Settings only
// (the owner, 2026-11-23: "redundunt logout button, retain the one in
// settings"), as in the Rider app.
const SettingsScreen = () => {
  const look = modern(useTheme());
  const styles = getStyles(look);
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const userInfo = useSelector(selectUserInfo);
  const seenPromoIds = useSelector(selectSeenPromoIds);
  const walletRequest = useApiRequest();
  const promoRequest = usePostRequest();
  const [balance, setBalance] = useState(
    userInfo?.wallet_details?.avail_balance ?? null,
  );
  const [promoIds, setPromoIds] = useState([]);
  const [showSafetyGuide, setShowSafetyGuide] = useState(false);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        navigation.popToTop();
        return true;
      },
    );
    return () => backHandler.remove();
  }, [navigation]);

  // the balance and the promos, read again each time the page shows
  useFocusEffect(
    useCallback(() => {
      if (!userInfo?.id) {
        return undefined;
      }
      let showing = true;
      (async () => {
        const { response } = await walletRequest.request(
          'GET',
          `${AppConstants.API.CUSTOMER_WALLET(userInfo.id)}?take=0`,
        );
        const amount = response?.data?.availBalance;
        if (showing && amount !== undefined && amount !== null) {
          setBalance(amount);
        }
      })();
      (async () => {
        const { response } = await promoRequest.makePostRequest(
          AppConstants.ENDPOINT.GET_PROMO_LIST,
          {},
        );
        const promos = response?.data?.promos;
        if (showing && Array.isArray(promos)) {
          setPromoIds(promos.map(promo => String(promo.id)));
        }
      })();
      return () => {
        showing = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userInfo?.id]),
  );

  const profileComplete = !!userInfo?.profile_complete;
  const name = fullNameOf(userInfo);
  const photo = userInfo?.selfie || userInfo?.ekyc_details?.selfie || '';
  const mobile = displayMobile(
    userInfo?.mobile || userInfo?.ekyc_details?.mobile_no,
  );
  const balanceText = `₱${AppUtil.fn(balance ?? 0)}`;
  const newPromos = promoIds.filter(id => !seenPromoIds.includes(id)).length;
  const version = Constants.expoConfig?.version ?? '';

  const openPromos = () => {
    dispatch(markPromosSeen(promoIds));
    navigation.navigate('PromoReferralsScreen');
  };

  // asked for by the owner, 2026-11-22: there is no help page yet
  const helpComingSoon = () =>
    appAlert('Help & support', 'Help and support in the app is coming soon.');

  return (
    <Container style={styles.container} background={look.page}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.popToTop()}
          hitSlop={8}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Back">
          <Icon name="chevron-left" size={28} color={look.ink} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          Account
        </Text>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        {/* who you are: the card opens the profile, Edit the name and photo */}
        <Pressable
          onPress={() =>
            navigation.navigate(
              profileComplete ? 'ProfileScreen' : 'CompleteProfileScreen',
            )
          }
          accessibilityRole="button"
          accessibilityLabel={[name || 'Your profile', mobile]
            .filter(Boolean)
            .join(', ')}
          style={({ pressed }) => [styles.profile, pressed && styles.pressed]}>
          <ProfileAvatar
            uri={photo}
            name={name}
            size={56}
            badge={genderOf(userInfo?.gender)?.icon}
            badgeLabel={genderOf(userInfo?.gender)?.label}
          />
          {/* a long name takes a second line, and the number stays on one
              (QA RD-APP-01: names were cut and "7271" fell to a line of its
              own on narrow phones) */}
          <View style={styles.flex}>
            <Text style={styles.name} numberOfLines={2}>
              {name || 'Complete your profile'}
            </Text>
            {mobile ? (
              <Text
                style={styles.mobile}
                numberOfLines={1}
                adjustsFontSizeToFit
                maxFontSizeMultiplier={1.3}>
                {mobile}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={() => navigation.navigate('CompleteProfileScreen')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={
              profileComplete ? 'Edit your profile' : 'Set up your profile'
            }
            style={({ pressed }) => [styles.edit, pressed && styles.pressed]}>
            <Text style={styles.editText}>
              {profileComplete ? 'Edit' : 'Set up'}
            </Text>
          </Pressable>
        </Pressable>

        {/* the wallet: the card opens the Wallet page, Cash in the top-up */}
        <Pressable
          onPress={() => navigation.navigate('WalletScreen')}
          accessibilityRole="button"
          accessibilityLabel={`PinoyRide Wallet, ${balanceText}`}
          style={({ pressed }) => [styles.wallet, pressed && styles.pressed]}>
          <View style={styles.flex}>
            <Text style={styles.walletLabel}>PINOYRIDE WALLET</Text>
            <Text
              style={styles.walletAmount}
              numberOfLines={1}
              adjustsFontSizeToFit
              maxFontSizeMultiplier={1.2}>
              {balanceText}
            </Text>
          </View>
          <Pressable
            onPress={() =>
              navigation.navigate('CashInScreen', {
                available_balance: balance ?? 0,
              })
            }
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Cash in"
            style={({ pressed }) => [styles.cashIn, pressed && styles.pressed]}>
            <Icon name="plus" size={17} color={look.onGold} />
            <Text style={styles.cashInText}>Cash in</Text>
          </Pressable>
        </Pressable>

        <MenuGroup label="Rides" style={styles.section}>
          <MenuRow
            icon="clock-outline"
            title="Booking history"
            onPress={() => navigation.navigate('BookingHistoryScreen')}
          />
          <MenuRow
            icon="tag-outline"
            title="Promo & referrals"
            badge={newPromos > 0 ? `${newPromos} NEW` : undefined}
            onPress={openPromos}
          />
          <MenuRow
            icon="credit-card-outline"
            title="Payment options"
            value="Wallet first"
            onPress={() => navigation.navigate('PaymentOptionScreen')}
          />
        </MenuGroup>

        <MenuGroup label="Account" style={styles.section}>
          <MenuRow
            icon="cog-outline"
            title="Settings"
            note="Dark mode, log out, delete account"
            tone="quiet"
            onPress={() => navigation.navigate('AccountSettingsScreen')}
          />
          <MenuRow
            icon="help-circle-outline"
            title="Help & support"
            tone="quiet"
            onPress={helpComingSoon}
          />
        </MenuGroup>

        <MenuGroup style={styles.emergency}>
          <MenuRow
            icon="shield-alert-outline"
            title="Emergency assistance"
            note="Reach help while you are on a trip"
            tone="danger"
            onPress={() => setShowSafetyGuide(true)}
          />
        </MenuGroup>

        <View style={styles.spacer} />
        <Text style={styles.version}>
          PinoyRide {version} · build {APP_BUILD}
        </Text>
      </ScrollView>

      <SafetyGuideModal
        visible={showSafetyGuide}
        onClose={() => setShowSafetyGuide(false)}
      />
    </Container>
  );
};

export default SettingsScreen;

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
    // The scroll area itself reaches 4 past Container's 20. On its content the
    // same margin pushed the cards' sides and the section labels' first
    // letters out of the scroll area, which cut them off.
    scrollArea: { marginHorizontal: -4 },
    scroll: { flexGrow: 1, paddingBottom: 16 },
    flex: { flex: 1 },
    pressed: { opacity: 0.85 },
    profile: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 14,
      borderRadius: look.radiusCard,
      backgroundColor: look.card,
    },
    name: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 16,
      lineHeight: 22,
      letterSpacing: -0.2,
      color: look.ink,
    },
    mobile: {
      marginTop: 1,
      fontFamily: 'Poppins Regular',
      fontSize: 13,
      lineHeight: 18,
      color: look.muted,
    },
    edit: {
      height: 27,
      paddingHorizontal: 12,
      borderRadius: 8,
      justifyContent: 'center',
      backgroundColor: look.chip,
    },
    editText: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 13,
      lineHeight: 17,
      color: look.chipInk,
    },
    wallet: {
      marginTop: 14,
      minHeight: 82,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: look.radiusCard,
      backgroundColor: look.gold,
    },
    walletLabel: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 11.5,
      lineHeight: 15,
      letterSpacing: 1.2,
      color: look.onGoldSoft,
    },
    walletAmount: {
      marginTop: 4,
      fontFamily: 'Poppins SemiBold',
      fontSize: 28,
      lineHeight: 34,
      letterSpacing: -0.6,
      color: look.onGold,
    },
    cashIn: {
      height: 32,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: look.goldShade,
    },
    cashInText: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 14,
      lineHeight: 18,
      color: look.onGold,
    },
    section: { marginTop: 24 },
    emergency: { marginTop: 22 },
    spacer: { flex: 1, minHeight: 32 },
    version: {
      marginTop: 18,
      textAlign: 'center',
      fontFamily: 'Poppins Regular',
      fontSize: 12,
      lineHeight: 16,
      color: look.faint,
    },
  });
