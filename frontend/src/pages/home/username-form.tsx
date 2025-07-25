import { useState } from 'react';
import { usernameStore } from '@/stores/username-store';

interface UsernameFormProps {
  onUsernameSet?: () => void;
}

export function UsernameForm({ onUsernameSet }: UsernameFormProps) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const { actions } = usernameStore();

  const validateUsername = (username: string): string | null => {
    const trimmed = username.trim();
    if (!trimmed) {
      return 'Username is required';
    }
    if (trimmed.length < 2) {
      return 'Username must be at least 2 characters';
    }
    if (trimmed.length > 20) {
      return 'Username must be 20 characters or less';
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      return 'Username can only contain letters, numbers, hyphens, and underscores';
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateUsername(inputValue);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    actions.setUsername(inputValue);
    setInputValue('');
    onUsernameSet?.();
  };

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Choose Your Username</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (error) setError('');
            }}
            placeholder="Enter your username"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            maxLength={20}
          />
          {error && (
            <p className="mt-1 text-sm text-red-600">{error}</p>
          )}
        </div>
        
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          Set Username
        </button>
      </form>
    </div>
  );
}