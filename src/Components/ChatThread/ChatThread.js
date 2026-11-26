import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  useIsFocused,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import { launchImageLibrary } from 'react-native-image-picker';

import ProfileAvatar from '@/Components/ProfileAvatar/ProfileAvatar';
import { Constants } from '@/Utils';
import { bottomSpace } from '@/Utils/bottomSpace';
import { selectUserInfo } from '@/Redux/Slices/userSlice';
import usePostRequest from '@/Services/Api';
import { modern } from '@/Theme/modern';

// The chat of a booking between the passenger and the rider: the same file in
// both apps (sharedUi.test.mjs). `me` says whose app it is: 'customer' in the
// Passenger app, 'rider' in the Rider app. Redrawn in the shared look (the
// owner, 2026-11-23: "fix also this in message"): a quiet header, my messages
// in dark ink on gold (they were white on yellow, hard to read), theirs on a
// white card.
//
// The keyboard (the owner, 2026-11-23: "when the keyboard pops the chat box
// was overlapped and i cannot see what i am typing"): `androidKeyboard` says
// how this app's Android window meets it. 'padding' where the window is drawn
// edge to edge and does not shrink for the keyboard (the Passenger app): the
// screen lifts the message box above it. Left out where the window pans up to
// the field by itself (the Rider app's adjustPan). iOS always lifts it.

const POLL_INTERVAL_MS = 5000;

// The other side of the chat, as seen from each app.
const OTHER_SIDE = {
  customer: { type: 'rider', name: 'Rider', whom: 'your rider' },
  rider: { type: 'customer', name: 'Passenger', whom: 'your passenger' },
};

const ChatThread = ({ me = 'customer', androidKeyboard }) => {
  const look = modern(useTheme());
  const navigation = useNavigation();
  const route = useRoute();
  const isFocused = useIsFocused();
  const { top: topInset, bottom: bottomInset } = useSafeAreaInsets();
  const lifts = Platform.OS === 'ios' || androidKeyboard === 'padding';
  const [keyboardUp, setKeyboardUp] = useState(false);
  // with the box lifted onto the keyboard, the room kept for the navigation
  // bar below it is not needed
  const styles = getStyles(
    look,
    topInset,
    lifts && keyboardUp ? 0 : bottomInset,
  );
  const side = OTHER_SIDE[me] || OTHER_SIDE.customer;

  const userInfo = useSelector(selectUserInfo);
  const myId = userInfo?.id;

  const {
    bookingId,
    otherPartyName: initialOtherPartyName,
    otherPartyAvatar: initialOtherPartyAvatar,
  } = route.params || {};

  const [messages, setMessages] = useState([]);
  const [otherParty, setOtherParty] = useState({
    name: initialOtherPartyName || side.name,
    avatar: initialOtherPartyAvatar || null,
  });
  // their own name is known (not just "Rider" or "Passenger")
  const named = otherParty.name !== side.name;
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [pendingImage, setPendingImage] = useState(null);

  const pollRef = useRef(null);
  const hasLoadedOnceRef = useRef(false);
  const listRef = useRef(null);

  // The newest message stays in view when the keyboard comes up.
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardUp(true);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    });
    const hidden = Keyboard.addListener('keyboardDidHide', () =>
      setKeyboardUp(false),
    );
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  // The same signed request (user_type, id, app_version, signature) as every
  // other screen.
  const getConversation = usePostRequest();
  const markMessagesRead = usePostRequest();
  const sendMessage = usePostRequest();

  const sending = sendMessage.loading;

  const fetchConversation = useCallback(
    async ({ showLoading = false } = {}) => {
      if (!bookingId || !myId) {
        return;
      }
      if (showLoading) {
        setLoading(true);
      }
      const other = OTHER_SIDE[me] || OTHER_SIDE.customer;

      const { response, error } = await getConversation.makePostRequest(
        Constants.ENDPOINT.GET_CONVERSATION,
        {
          booking_id: bookingId,
          user_id: myId,
          user_type: me,
          last_seen_id: null,
        },
        {},
        'json',
      );

      if (error) {
        console.warn('Failed to fetch conversation:', error);
      } else if (response?.code === 200 && response?.data) {
        setMessages(response.data.conversation || []);

        const details = response.data.details?.[other.type];
        if (details) {
          setOtherParty({
            name:
              `${details.first_name || ''} ${details.last_name || ''}`.trim() ||
              other.name,
            avatar: details.ekyc_details?.selfie || details.selfie || null,
          });
        }

        // Reset unread state for whatever just came in.
        markMessagesRead
          .makePostRequest(
            Constants.ENDPOINT.MARK_MESSAGES_READ,
            { booking_id: bookingId, user_id: myId, user_type: me },
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
    [bookingId, myId, me],
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

  const ready = inputText.trim() !== '' || pendingImage != null;

  const handleSend = async () => {
    const trimmed = inputText.trim();
    if (!ready || sending || !bookingId || !myId) {
      return;
    }

    const postdata = {
      booking_id: bookingId,
      sender_id: myId,
      sender_type: me,
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
    // Pull the fresh conversation (includes the message just sent): the
    // server sets the id, the time and the photo's address.
    fetchConversation();
  };

  const renderMessage = ({ item }) => {
    const isMine = !!item.is_sent_by_me;
    return (
      <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
        <View
          style={[
            styles.bubble,
            isMine ? styles.bubbleMine : styles.bubbleTheirs,
          ]}>
          {item.image_msg_pretty ? (
            <Image
              source={{ uri: item.image_msg_pretty }}
              style={[styles.photo, item.message_text && styles.photoAbove]}
              resizeMode="cover"
            />
          ) : null}
          {item.message_text ? (
            <Text
              selectable
              style={[
                styles.text,
                isMine ? styles.textMine : styles.textTheirs,
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
      style={styles.page}
      behavior={lifts ? 'padding' : undefined}
      keyboardVerticalOffset={0}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.back}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <Icon name="chevron-left" size={28} color={look.ink} />
        </Pressable>
        <ProfileAvatar
          uri={otherParty.avatar}
          name={named ? otherParty.name : undefined}
          size={40}
        />
        <View style={styles.headerText}>
          <Text
            style={styles.name}
            numberOfLines={1}
            accessibilityRole="header">
            {otherParty.name}
          </Text>
          {named ? (
            <Text style={styles.role} numberOfLines={1}>
              {side.name}
            </Text>
          ) : null}
        </View>
      </View>

      {loading && !hasLoadedOnceRef.current ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={look.accent} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={item => String(item.id)}
          renderItem={renderMessage}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          // the newest message is the last: keep it in view as messages come
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: true })
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyText}>
                {`Send a message to ${side.whom}.`}
              </Text>
            </View>
          }
        />
      )}

      <View style={styles.footer}>
        {pendingImage ? (
          <View style={styles.pending}>
            <Image
              source={{ uri: pendingImage.uri }}
              style={styles.pendingPhoto}
            />
            <Pressable
              onPress={() => setPendingImage(null)}
              style={styles.pendingRemove}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Remove the photo">
              <Icon name="close" size={14} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : null}
        <View style={styles.bar}>
          <Pressable
            onPress={handlePickImage}
            style={({ pressed }) => [styles.attach, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Attach a photo">
            <Icon name="image-plus" size={22} color={look.inkSoft} />
          </Pressable>
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message"
            placeholderTextColor={look.muted}
            style={styles.input}
            multiline
          />
          <Pressable
            onPress={handleSend}
            disabled={!ready || sending}
            style={({ pressed }) => [
              styles.send,
              ready ? styles.sendOn : styles.sendOff,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ disabled: !ready || sending }}>
            {sending ? (
              <ActivityIndicator size="small" color={look.onGold} />
            ) : (
              <Icon
                name="send"
                size={20}
                color={ready ? look.onGold : look.faint}
              />
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

export default ChatThread;

const getStyles = (look, topInset, bottomInset) =>
  StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: look.page,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: topInset + 6,
      paddingBottom: 10,
      paddingLeft: 4,
      paddingRight: 16,
      backgroundColor: look.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: look.hairline,
    },
    back: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 4,
    },
    headerText: {
      flex: 1,
      marginLeft: 12,
    },
    name: {
      fontFamily: 'Poppins SemiBold',
      fontSize: 17,
      lineHeight: 22,
      letterSpacing: -0.2,
      color: look.ink,
    },
    role: {
      fontFamily: 'Poppins Regular',
      fontSize: 13,
      lineHeight: 18,
      color: look.muted,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    list: {
      flexGrow: 1,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
    },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    emptyTitle: {
      fontFamily: 'Poppins Medium',
      fontSize: 15,
      lineHeight: 20,
      color: look.ink,
    },
    emptyText: {
      marginTop: 4,
      fontFamily: 'Poppins Regular',
      fontSize: 13,
      lineHeight: 18,
      color: look.muted,
      textAlign: 'center',
    },
    row: {
      flexDirection: 'row',
      marginBottom: 8,
    },
    rowMine: {
      justifyContent: 'flex-end',
    },
    rowTheirs: {
      justifyContent: 'flex-start',
    },
    bubble: {
      maxWidth: '78%',
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    bubbleMine: {
      backgroundColor: look.gold,
      borderBottomRightRadius: 6,
    },
    bubbleTheirs: {
      backgroundColor: look.card,
      borderBottomLeftRadius: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: look.hairline,
    },
    text: {
      fontFamily: 'Poppins Regular',
      fontSize: 15,
      lineHeight: 21,
    },
    textMine: {
      color: look.onGold,
    },
    textTheirs: {
      color: look.ink,
    },
    photo: {
      width: 200,
      height: 200,
      borderRadius: 14,
    },
    photoAbove: {
      marginBottom: 8,
    },
    footer: {
      paddingTop: 10,
      paddingHorizontal: 12,
      paddingBottom: bottomSpace(bottomInset, 12, 8),
      backgroundColor: look.card,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: look.hairline,
    },
    pending: {
      alignSelf: 'flex-start',
      marginLeft: 4,
      marginBottom: 10,
    },
    pendingPhoto: {
      width: 64,
      height: 64,
      borderRadius: 12,
    },
    pendingRemove: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: 'rgba(23, 23, 28, 0.72)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
    },
    attach: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: look.tile,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
    input: {
      flex: 1,
      minHeight: 44,
      maxHeight: 120,
      paddingHorizontal: 16,
      paddingTop: 11,
      paddingBottom: 11,
      borderRadius: 22,
      backgroundColor: look.soft,
      fontFamily: 'Poppins Regular',
      fontSize: 15,
      lineHeight: 20,
      color: look.ink,
      textAlignVertical: 'center',
    },
    send: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
    },
    sendOn: {
      backgroundColor: look.gold,
    },
    sendOff: {
      backgroundColor: look.tile,
    },
    pressed: {
      opacity: 0.85,
    },
  });
