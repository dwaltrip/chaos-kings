import { usernameStore } from '@/stores/username-store';
import { UsernameForm } from './username-form';

export function HomePage() {
  const { username, isLoading, actions } = usernameStore();

  const handleChangeUsername = () => {
    actions.clearUsername();
  };

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto">
        <div className="text-center text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-800 text-center">
        Welcome to Game Rooms
      </h1>
      
      {username ? (
        <div className="bg-green-50 p-6 rounded-lg border border-green-200">
          <h2 className="text-lg font-semibold text-green-800 mb-2">
            Hello, {username}!
          </h2>
          <p className="text-green-700 mb-4">
            You're all set to join game rooms.
          </p>
          <button
            onClick={handleChangeUsername}
            className="text-green-600 hover:text-green-800 underline text-sm"
          >
            Change username
          </button>
        </div>
      ) : (
        <UsernameForm />
      )}
    </div>
  );
}
