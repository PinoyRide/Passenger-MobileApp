import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import {
  useIsFocused,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { launchImageLibrary } from 'react-native-image-picker';

import { Constants } from '@/Utils';
import { selectUserInfo } from '@/Redux/Slices/userSlice';
import usePostRequest from '@/Services/Api';

// NOTE: assumes `react-native-image-picker` is (or will be) installed for
// the "+" attachment button — matches the rider app's ChatScreen. Swap this
// import out if the project standardizes on a different picker.

const POLL_INTERVAL_MS = 5000;

// Uses the same usePostRequest hook (and the same signed
// user_type/customer_id/app_version/signature envelope) as every other
// screen — no special-cased axios calls here.

const ChatScreen = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const isFocused = useIsFocused();
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();
  const styles = getStyles({ colors, topInset, bottomInset });

  const userInfo = useSelector(selectUserInfo);
  const customerId = userInfo?.id;

  const {
    bookingId,
    otherPartyName: initialOtherPartyName,
    otherPartyAvatar: initialOtherPartyAvatar,
  } = route.params || {};

  const [messages, setMessages] = useState([]);
  const [otherParty, setOtherParty] = useState({
    name: initialOtherPartyName || 'Rider',
    avatar: initialOtherPartyAvatar || null,
  });
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [pendingImage, setPendingImage] = useState(null);

  const pollRef = useRef(null);
  const hasLoadedOnceRef = useRef(false);

  const getConversation = usePostRequest();
  const markMessagesRead = usePostRequest();
  const sendMessage = usePostRequest();

  const sending = sendMessage.loading;

  const fetchConversation = useCallback(
    async ({ showLoading = false } = {}) => {
      if (!bookingId || !customerId) {
        return;
      }
      if (showLoading) {
        setLoading(true);
      }

      const { response, error } = await getConversation.makePostRequest(
        Constants.ENDPOINT.GET_CONVERSATION,
        {
          booking_id: bookingId,
          user_id: customerId,
          user_type: 'customer',
          last_seen_id: null,
        },
        {},
        'json',
      );

      if (error) {
        console.warn('Failed to fetch conversation:', error);
      } else if (response?.code === 200 && response?.data) {
        const convo = response.data.conversation || [];
        setMessages(convo);

        const riderDetails = response.data.details?.rider;
        if (riderDetails) {
          setOtherParty({
            name:
              `${riderDetails.first_name || ''} ${
                riderDetails.last_name || ''
              }`.trim() || 'Rider',
            avatar: riderDetails.selfie || null,
          });
        }

        // Reset unread state for whatever just came in.
        markMessagesRead
          .makePostRequest(
            Constants.ENDPOINT.MARK_MESSAGES_READ,
            {
              booking_id: bookingId,
              user_id: customerId,
              user_type: 'customer',
            },
            {},
            'json',
          )
          .then(({ error: markError }) => {
            if (markError) {
              console.warn('Failed to mark messages read:', markError);
            }
          });
      }

      hasLoadedOnceRef.current = true;
      setLoading(false);
    },
    [bookingId, customerId],
  );

  useEffect(() => {
    fetchConversation({ showLoading: true });
  }, [fetchConversation]);

  // Poll for new messages while this screen is focused.
  useEffect(() => {
    if (!isFocused) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    pollRef.current = setInterval(() => {
      fetchConversation();
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [isFocused, fetchConversation]);

  const handlePickImage = () => {
    launchImageLibrary({ mediaType: 'photo', quality: 0.7 }, response => {
      if (response.didCancel || response.errorCode) {
        return;
      }
      const asset = response.assets?.[0];
      if (asset) {
        setPendingImage(asset);
      }
    });
  };

  const handleSend = async () => {
    const trimmed = inputText.trim();
    if ((!trimmed && !pendingImage) || sending || !bookingId || !customerId) {
      return;
    }

    const postdata = {
      booking_id: bookingId,
      sender_id: customerId,
      sender_type: 'customer',
    };
    if (trimmed) {
      postdata.message_text = trimmed;
    }
    if (pendingImage) {
      // Detected as a file attachment in Api.js because it carries a `uri`.
      postdata.image_msg = pendingImage;
    }

    const { error } = await sendMessage.makePostRequest(
      Constants.ENDPOINT.SEND_MESSAGE,
      postdata,
      {},
      'multipart',
    );

    if (error) {
      console.warn('Failed to send message:', error);
      return;
    }

    setInputText('');
    setPendingImage(null);
    // Pull the fresh conversation (includes the message we just sent)
    // instead of hand-building an optimistic entry — the server sets
    // fields like id/created_at/pretty urls we don't have locally.
    fetchConversation();
  };

  const renderMessage = ({ item }) => {
    const isMine = !!item.is_sent_by_me;
    return (
      <View
        style={[
          styles.bubbleRow,
          isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs,
        ]}>
        <View
          style={[
            styles.bubble,
            isMine ? styles.bubbleMine : styles.bubbleTheirs,
          ]}>
          {item.image_msg_pretty ? (
            <Image
              source={{ uri: item.image_msg_pretty }}
              style={styles.messageImage}
              resizeMode="cover"
            />
          ) : null}
          {item.message_text ? (
            <Text
              style={[
                styles.bubbleText,
                isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs,
              ]}>
              {item.message_text}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? topInset : 0}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityLabel="Go back">
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Image
          source={
            otherParty.avatar
              ? { uri: otherParty.avatar }
              : require('@/Assets/Common/Default_Profile.png')
          }
          style={styles.headerAvatar}
        />
        <Text style={styles.headerName} numberOfLines={1}>
          {otherParty.name}
        </Text>
      </View>

      {loading && !hasLoadedOnceRef.current ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={item => String(item.id)}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
        />
      )}

      {pendingImage ? (
        <View style={styles.pendingImageRow}>
          <Image
            source={{ uri: pendingImage.uri }}
            style={styles.pendingImageThumb}
          />
          <TouchableOpacity
            onPress={() => setPendingImage(null)}
            style={styles.removePendingImage}>
            <Text style={styles.removePendingImageText}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.inputBar}>
        <TouchableOpacity
          onPress={handlePickImage}
          style={styles.attachButton}
          accessibilityLabel="Attach photo">
          <Text style={styles.attachIcon}>+</Text>
        </TouchableOpacity>
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message"
          placeholderTextColor={colors.grey3}
          style={styles.input}
          multiline
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={sending || (!inputText.trim() && !pendingImage)}
          style={[
            styles.sendButton,
            (sending || (!inputText.trim() && !pendingImage)) &&
              styles.sendButtonDisabled,
          ]}
          accessibilityLabel="Send message">
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendIcon}>➤</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

export default ChatScreen;

const getStyles = ({ colors, topInset, bottomInset }) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingTop: topInset + 10,
      paddingBottom: 16,
      paddingHorizontal: 16,
    },
    backButton: {
      paddingRight: 12,
      paddingVertical: 4,
    },
    backIcon: {
      fontSize: 30,
      color: '#fff',
      lineHeight: 30,
    },
    headerAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      marginRight: 10,
    },
    headerName: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 17,
      color: '#fff',
      flexShrink: 1,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      paddingHorizontal: 16,
      paddingVertical: 16,
      flexGrow: 1,
    },
    bubbleRow: {
      marginBottom: 14,
      flexDirection: 'row',
    },
    bubbleRowMine: { justifyContent: 'flex-end' },
    bubbleRowTheirs: { justifyContent: 'flex-start' },
    bubble: {
      maxWidth: '78%',
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    bubbleMine: {
      backgroundColor: colors.primary,
      borderBottomRightRadius: 4,
    },
    bubbleTheirs: {
      backgroundColor: colors.onQuaternary || '#EDEDED',
      borderBottomLeftRadius: 4,
    },
    bubbleText: {
      fontFamily: 'Poppins Regular',
      fontSize: 15,
      lineHeight: 21,
    },
    bubbleTextMine: { color: '#fff' },
    bubbleTextTheirs: { color: colors.text },
    messageImage: {
      width: 200,
      height: 200,
      borderRadius: 12,
      marginBottom: 6,
    },
    pendingImageRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    pendingImageThumb: {
      width: 56,
      height: 56,
      borderRadius: 8,
    },
    removePendingImage: {
      marginLeft: -14,
      marginTop: -40,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: '#00000099',
      alignItems: 'center',
      justifyContent: 'center',
    },
    removePendingImageText: {
      color: '#fff',
      fontSize: 12,
    },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: Math.max(bottomInset, 12),
      backgroundColor: '#FFF3D6',
    },
    attachButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
    attachIcon: {
      color: '#fff',
      fontSize: 22,
      lineHeight: 24,
    },
    input: {
      flex: 1,
      backgroundColor: '#fff',
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      maxHeight: 100,
      fontFamily: 'Poppins Regular',
      fontSize: 14,
      color: colors.text,
    },
    sendButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
    },
    sendButtonDisabled: {
      opacity: 0.5,
    },
    sendIcon: {
      color: '#fff',
      fontSize: 16,
    },
  });
