import React, { useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  NavigationContainer,
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  AccountSettingsScreen,
  BookingDetailsScreen,
  BookingHistoryScreen,
  CashInScreen,
  CashOutScreen,
  ChatScreen,
  CodeChannelScreen,
  CompleteProfileScreen,
  ConfirmDetailsScreen,
  CongratsScreen,
  DeleteAccountScreen,
  EKYCScreen,
  GeneralTermsScreen,
  HomeScreen,
  InputLocation,
  LandingScreen,
  LivenessSelfieScreen,
  LoginScreen,
  MapSelectionScreen,
  OTPScreen,
  OnboardingScreen,
  PaymentOptionScreen,
  PersonalDetailsScreen,
  PrivacyPolicyScreen,
  ProfileScreen,
  PromoReferralsScreen,
  QRPHScreen,
  RatingScreen,
  RegisterFormScreen,
  RegisterScreen,
  SaveLocationScreen,
  SelfieScreen,
  SettingsScreen,
  SplashScreen,
  TAC,
  UpdateRequiredScreen,
  UploadIDScreen,
  WalletScreen,
  WalletTransactionsScreen,
} from '@/Screens';
import { Text } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { AppTransactionComplete } from '@/Components';
import { useAppTheme } from '@/Contexts/ThemeContext';
import { navigationRef } from '@/Utils/NavigationService';

const Stack = createNativeStackNavigator();

const ApplicationNavigator = () => {
  const { theme, isDark } = useAppTheme();
  // The screens' own frame: in the light look the navigator's own theme, as it
  // was before dark mode came; in the dark look its dark theme in our colours.
  const navigationTheme = useMemo(
    () =>
      isDark
        ? {
            ...NavigationDarkTheme,
            colors: {
              ...NavigationDarkTheme.colors,
              primary: theme.colors.primary,
              background: theme.colors.background,
              card: theme.colors.card,
              text: theme.colors.text,
            },
          }
        : NavigationDefaultTheme,
    [isDark, theme],
  );

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <NavigationContainer theme={navigationTheme} ref={navigationRef}>
          <Stack.Navigator
            initialRouteName="Splash"
            screenOptions={{
              headerShown: true,
              headerTitle: props => (
                <Text style={{ color: navigationTheme.colors.text }}>
                  {props.children}
                </Text>
              ),

              headerBackTitleVisible: false,
            }}>
            <Stack.Screen
              name="Splash"
              component={SplashScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="OnboardingScreen"
              component={OnboardingScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="LandingScreen"
              component={LandingScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="RegisterScreen"
              component={RegisterScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="RegisterFormScreen"
              component={RegisterFormScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PersonalDetailsScreen"
              component={PersonalDetailsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="UploadIDScreen"
              component={UploadIDScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SelfieScreen"
              component={SelfieScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ConfirmDetailsScreen"
              component={ConfirmDetailsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="UpdateRequiredScreen"
              component={UpdateRequiredScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CongratsScreen"
              component={CongratsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="LoginScreen"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CodeChannelScreen"
              component={CodeChannelScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="OTPScreen"
              component={OTPScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="EKYCScreen"
              component={EKYCScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="GeneralTermsScreen"
              component={GeneralTermsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PrivacyPolicyScreen"
              component={PrivacyPolicyScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="TAC"
              component={TAC}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="HomeScreen"
              component={HomeScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="ChatScreen"
              component={ChatScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="InputLocation"
              component={InputLocation}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="MapSelectionScreen"
              component={MapSelectionScreen}
              options={{ headerShown: false, animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="SaveLocationScreen"
              component={SaveLocationScreen}
              options={{ headerShown: false, animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="RatingScreen"
              component={RatingScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="AccountSettingsScreen"
              component={AccountSettingsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="DeleteAccountScreen"
              component={DeleteAccountScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="SettingsScreen"
              component={SettingsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="BookingHistoryScreen"
              component={BookingHistoryScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="BookingDetailsScreen"
              component={BookingDetailsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PromoReferralsScreen"
              component={PromoReferralsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="PaymentOptionScreen"
              component={PaymentOptionScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="WalletScreen"
              component={WalletScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="WalletTransactionsScreen"
              component={WalletTransactionsScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CashInScreen"
              component={CashInScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CashOutScreen"
              component={CashOutScreen}
              options={{ headerShown: false }}
            />

            <Stack.Screen
              name="QRPHScreen"
              component={QRPHScreen}
              options={{ headerShown: false }}
            />

            <Stack.Screen
              name="AppTransactionComplete"
              component={AppTransactionComplete}
              options={{ headerShown: false }}
            />

            <Stack.Screen
              name="ProfileScreen"
              component={ProfileScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CompleteProfileScreen"
              component={CompleteProfileScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="LivenessSelfieScreen"
              component={LivenessSelfieScreen}
              options={{ headerShown: false }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
};

export default ApplicationNavigator;
