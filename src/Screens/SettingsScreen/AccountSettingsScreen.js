import React from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import Container from '@/Components/Container/Container';
import { MenuGroup, MenuRow } from '@/Components/Menu/Menu';
import useLogOut from '@/Services/useLogOut';
import { Constants as AppConstants } from '@/Utils';
import { runningUpdateLabel } from '@/Utils/selfUpdate';
import { modern } from '@/Theme/modern';

// Settings (the owner, 2026-11-22: "in my profile or profile page put the
// logout and delete account in settings menu, do this for rider and
// passenger"). Opened from the Account page, which also has Log out at its
// bottom (the owner's Account design). The same screen in the Rider app.
// Deleting the account is as strict as in the Admin Portal:
// DeleteAccountScreen.
const AccountSettingsScreen = () => {
  const look = modern(useTheme());
  const styles = getStyles(look);
  const navigation = useNavigation();
  const { confirmLogOut, loggingOut } = useLogOut();

  const appVersion = Constants.expoConfig?.version ?? '';
  const environment = AppConstants.IS_DEV ? ' · Develop' : '';
  const update = runningUpdateLabel();

  return (
    <Container style={styles.container} background={look.page}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}>
          <Image
            source={require('@/Assets/Common/Back.png')}
            style={styles.backIcon}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <MenuGroup>
          <MenuRow
            icon="logout"
            title="Log out"
            note="Sign out on this phone"
            tone="quiet"
            onPress={confirmLogOut}
            busy={loggingOut}
          />
        </MenuGroup>

        <MenuGroup style={styles.secondGroup}>
          <MenuRow
            icon="account-remove-outline"
            title="Delete account"
            note="Remove your account for good. We send you a code first."
            tone="danger"
            onPress={() => navigation.navigate('DeleteAccountScreen')}
            disabled={loggingOut}
          />
        </MenuGroup>

        <Text style={styles.version}>
          Pinoy Ride v{appVersion}
          {environment}
          {update ? ` · ${update}` : ''}
        </Text>
      </ScrollView>
    </Container>
  );
};

export default AccountSettingsScreen;

const getStyles = look =>
  StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 10 },
    header: { height: 52, justifyContent: 'center', marginBottom: 12 },
    backButton: {
      position: 'absolute',
      width: 52,
      height: 52,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2,
    },
    backIcon: { width: 23, height: 23 },
    headerTitleContainer: {
      position: 'absolute',
      left: 0,
      right: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      fontSize: 16,
      fontFamily: 'Poppins Medium',
      color: look.text,
    },
    scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
    secondGroup: { marginTop: 20 },
    version: {
      marginTop: 28,
      textAlign: 'center',
      fontSize: 12,
      fontFamily: 'Poppins Regular',
      color: look.muted,
    },
  });
