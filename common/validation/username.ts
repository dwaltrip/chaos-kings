interface UsernameValidationResult {
  isValid: boolean;
  error?: string;
}

function validateUsername(username: string): UsernameValidationResult {
  const trimmed = username.trim();

  if (!trimmed) {
    return { isValid: false, error: 'Username is required' };
  }

  if (trimmed.length < 1) {
    return { isValid: false, error: 'Username must be at least 1 character' };
  }

  if (trimmed.length > 25) {
    return { isValid: false, error: 'Username must be 25 characters or less' };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return {
      isValid: false,
      error:
        'Username can only contain letters, numbers, underscores, and hyphens',
    };
  }

  return { isValid: true };
}

export { validateUsername, type UsernameValidationResult };
