import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Container from '@/Components/Container/Container';
import useApiRequest from '@/Services/ApiV2';
import { Constants as AppConstants } from '@/Utils';
import { modern } from '@/Theme/modern';
import { selectUserInfo } from '@/Redux/Slices/userSlice';
import TransactionRow, { EmptyTransactions } from './TransactionRow';

// Every transaction of the wallet, newest first, 20 at a time: the Wallet
// page's "See all".
const WalletTransactionsScreen = () => {
  const look = modern(useTheme());
  const styles = getStyles(look);
  const navigation = useNavigation();
  // whether the Wallet page said locked, for the empty list's note
  const locked = useRoute().params?.locked === true;
  const userInfo = useSelector(selectUserInfo);
  const historyRequest = useApiRequest();
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const busyRef = useRef(false);

  const loadPage = async next => {
    if (busyRef.current || !userInfo?.id) {
      return;
    }
    busyRef.current = true;
    const { response } = await historyRequest.request(
      'GET',
      AppConstants.API.CUSTOMER_WALLET_HISTORY(userInfo.id, next),
    );
    busyRef.current = false;
    const data = response?.data;
    if (data) {
      const pageItems = Array.isArray(data.items) ? data.items : [];
      setItems(previous =>
        next === 1 ? pageItems : [...previous, ...pageItems],
      );
      setPage(next);
      setHasNext(Boolean(data.hasNext));
    } else {
      setHasNext(false);
    }
    setLoaded(true);
  };

  useEffect(() => {
    loadPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userInfo?.id]);

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
          Transactions
        </Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={item => String(item.id)}
        renderItem={({ item, index }) => (
          <TransactionRow item={item} look={look} divided={index > 0} />
        )}
        onEndReached={() => {
          if (hasNext && loaded) {
            loadPage(page + 1);
          }
        }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          loaded ? (
            <EmptyTransactions look={look} locked={locked} />
          ) : (
            <ActivityIndicator style={styles.loading} color={look.muted} />
          )
        }
        ListFooterComponent={
          loaded && hasNext && items.length > 0 ? (
            <ActivityIndicator style={styles.more} color={look.muted} />
          ) : null
        }
        style={styles.list}
        contentContainerStyle={items.length === 0 && styles.listEmpty}
        showsVerticalScrollIndicator={false}
      />
    </Container>
  );
};

export default WalletTransactionsScreen;

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
    list: {
      flexGrow: 0,
      marginHorizontal: -4,
      marginBottom: 16,
      borderRadius: look.radiusCard,
      backgroundColor: look.card,
    },
    listEmpty: { minHeight: 360 },
    loading: { marginVertical: 40 },
    more: { marginVertical: 16 },
  });
