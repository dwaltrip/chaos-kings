import { useState, useEffect } from 'react';

type StoreListener = () => void;

const WsStore = (function() {
  let _isConnected = false;
  let _listeners = new Set<StoreListener>();
  
  const notifyListeners = () => {
    _listeners.forEach(listener => listener());
  };
  
  return {
    getIsConnected: () => _isConnected,
    
    setIsConnected: (isConnected: boolean) => {
      _isConnected = isConnected;
      notifyListeners();
    },
    
    subscribe: (listener: StoreListener) => {
      _listeners.add(listener);
      return () => {
        _listeners.delete(listener);
      };
    },
    
    getState: () => ({
      isConnected: _isConnected,
    })
  };
})();

const useWsStore = () => {
  const [state, setState] = useState(WsStore.getState());
  
  useEffect(() => {
    const unsubscribe = WsStore.subscribe(() => {
      setState(WsStore.getState());
    });
    return unsubscribe;
  }, []);
  
  return {
    ...state,
    actions: {
      setIsConnected: WsStore.setIsConnected,
    }
  };
};

export { WsStore, useWsStore };
