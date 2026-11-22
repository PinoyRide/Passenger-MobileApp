import React from 'react';
import ChatThread from '@/Components/ChatThread/ChatThread';

// The chat with the booking's rider. The screen is the same file in both
// apps (Components/ChatThread); this app is the passenger's side of it. Its
// Android window is drawn edge to edge (gradle.properties edgeToEdgeEnabled)
// and does not shrink for the keyboard, so the chat lifts its message box.
const ChatScreen = () => <ChatThread me="customer" androidKeyboard="padding" />;

export default ChatScreen;
