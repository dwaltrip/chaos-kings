import { Link } from 'react-router';
import type { User } from '@/domains/users/types';

import { FmtDate } from '@/ui-lib/components/format-date';

import './user-info.css';

interface UserInfoProps {
  user: User;
}

function UserInfo({ user }: UserInfoProps) {
  return (
    <div className="user-info">
      <section>
        <Link to={`/users/${user.id}`}>
          <div className="username profile-link">{user.username}</div>
        </Link>
      </section>

      <section>
        <div className="rank-info">Level 99</div>
      </section>

      <section>
        <div className="join-date">
          <FmtDate date={user.createdAt} />
        </div>
      </section>
    </div>
  );
}

export { UserInfo };
