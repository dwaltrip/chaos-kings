import { useState, useEffect } from 'react';
import { WsStore } from '../services/ws-store';

interface ChatMessage {
  id: string;
  content: string;
  user: string;
  timestamp: Date;
}

type StoreListener = () => void;

const ChatDemoStore = (function() {
  let _messages = [] as ChatMessage[];
  let _username = '';
  let _currentRoom = 'general';
  let _isConnected = false;
  let _currentMessage = '';
  let _newRoomName = '';
  let _listeners = new Set<StoreListener>();
  
  const notifyListeners = () => {
    _listeners.forEach(listener => listener());
  };
  
  return {
    getMessages: () => _messages,
    getUsername: () => _username,
    getCurrentRoom: () => _currentRoom,
    getIsConnected: () => _isConnected,
    getCurrentMessage: () => _currentMessage,
    getNewRoomName: () => _newRoomName,
    
    setMessages: (messages: ChatMessage[]) => {
      _messages = messages;
      notifyListeners();
    },
    addMessage: (message: ChatMessage) => {
      const newMessages = [..._messages, message];
      _messages = newMessages;
      notifyListeners();
    },
    setUsername: (username: string) => {
      _username = username;
      notifyListeners();
    },
    setCurrentRoom: (currentRoom: string) => {
      _currentRoom = currentRoom;
      notifyListeners();
    },
    setIsConnected: (isConnected: boolean) => {
      _isConnected = isConnected;
      notifyListeners();
    },
    setCurrentMessage: (currentMessage: string) => {
      _currentMessage = currentMessage;
      notifyListeners();
    },
    setNewRoomName: (newRoomName: string) => {
      _newRoomName = newRoomName;
      notifyListeners();
    },
    clearMessages: () => {
      _messages = [];
      notifyListeners();
    },
    
    subscribe: (listener: StoreListener) => {
      _listeners.add(listener);
      return () => {
        _listeners.delete(listener);
      };
    },
    
    getState: () => ({
      messages: _messages,
      username: _username,
      currentRoom: _currentRoom,
      isConnected: _isConnected,
      currentMessage: _currentMessage,
      newRoomName: _newRoomName,
    })
  };
})();

const useChatStore = () => {
  const [state, setState] = useState(ChatDemoStore.getState());
  
  useEffect(() => {
    const unsubscribe = ChatDemoStore.subscribe(() => {
      setState(ChatDemoStore.getState());
    });
    return unsubscribe;
  }, []);
  
  return {
    ...state,
    actions: {
      setMessages: ChatDemoStore.setMessages,
      addMessage: ChatDemoStore.addMessage,
      setUsername: ChatDemoStore.setUsername,
      setCurrentRoom: ChatDemoStore.setCurrentRoom,
      setIsConnected: ChatDemoStore.setIsConnected,
      setCurrentMessage: ChatDemoStore.setCurrentMessage,
      setNewRoomName: ChatDemoStore.setNewRoomName,
      clearMessages: ChatDemoStore.clearMessages,
    }
  };
};

export { ChatDemoStore, useChatStore };
