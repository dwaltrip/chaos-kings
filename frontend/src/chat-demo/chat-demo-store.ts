
interface ChatMessage {
  id: string;
  content: string;
  sender: string;
  timestamp: Date;
}

const ChatDemoStore = (function() {
  let _messages = [] as ChatMessage[];
  let _username =  '';
  let _currentRoom = 'general';
  let _isConnected = false;
  let _currentMessage = '';
  let _newRoomName = '';
  
  return {
    setMessages: (messages: ChatMessage[]) => {
      _messages = messages;
    },
    addMessage: (message: ChatMessage) => {
      const newMessages = [..._messages, message];
      _messages = newMessages;
    },
    setUsername: (username: string) => {
      _username = username;
    },
    setCurrentRoom: (currentRoom: string) => {
      _currentRoom = currentRoom;
    },
    setIsConnected: (isConnected: boolean) => {
      _isConnected = isConnected;
    },
    setCurrentMessage: (currentMessage: string) => {
      _currentMessage = currentMessage;
    },
    setNewRoomName: (newRoomName: string) => {
      _newRoomName = newRoomName;
    },
    clearMessages: () => {
      _messages = [];
    },
  };
})();

export { ChatDemoStore };

