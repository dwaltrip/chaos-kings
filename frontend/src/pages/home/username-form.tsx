import { useState } from 'react';
import { userStore } from '@/stores/user-store';
import { validateUsername } from '@/utils/username-validation';

interface UsernameFormProps {
  onUsernameSet?: () => void;
}

function UsernameForm({ onUsernameSet }: UsernameFormProps) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const { actions } = userStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationResult = validateUsername(inputValue);
    if (!validationResult.isValid) {
      setError(validationResult.error || '');
      return;
    }

    try {
      setError('');
      await actions.updateUsername(inputValue);
      setInputValue('');
      onUsernameSet?.();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to update username',
      );
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">
        Choose Your Username
      </h2>

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
            maxLength={25}
          />
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
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

export { UsernameForm };
