import type { User } from '@/domains/users/types';

import { FmtDate } from '@/ui-lib/components/fmt-date';

interface UserInfoProps {
  user: User;
}

function UserInfo({ user }: UserInfoProps) {
  return (
    <div className="user-info">
      <div className="username">{user.username}</div>

      <div className="member-since">
        Member since: <FmtDate date={user.createdAt} />
      </div>
    </div>
  );
}

export { UserInfo };
