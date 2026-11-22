import React from 'react';
import ChatThread from '@/Components/ChatThread/ChatThread';

// The chat with the booking's rider. The screen is the same file in both
// apps (Components/ChatThread); this app is the passenger's side of it.
const ChatScreen = () => <ChatThread me="customer" />;

export default ChatScreen;
