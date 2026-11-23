import { configureStore } from '@reduxjs/toolkit';
import { persistReducer, persistStore } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import userReducer from './Slices/userSlice';

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  // Wait for the saved state however long the phone takes (redux-persist
  // gives up after 5 s by default, then writes the empty start state over
  // what was saved: the person was signed out, and the server still had them
  // signed in, so signing in again was refused. Overnight review 2026-11-23).
  timeout: 0,
};

const persistedReducer = persistReducer(persistConfig, userReducer);

export const store = configureStore({
  reducer: {
    user: persistedReducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          'persist/PERSIST',
          'persist/REHYDRATE',
          'persist/FLUSH',
          'persist/PAUSE',
          'persist/PURGE',
          'persist/REGISTER',
        ],
      },
    }),
});

export const persistor = persistStore(store);
