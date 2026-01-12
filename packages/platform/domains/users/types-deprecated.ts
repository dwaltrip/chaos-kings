interface User {
  id: number;
  username: string;
  user_key: string;
  // created_at: string;
  created_at: Date;
  session_id?: string;
}

export { type User };
