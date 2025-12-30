import { useParams } from 'react-router';

function ProfilePage() {
  const { userId } = useParams();
  console.log('profilePage - userId:', userId);

  return <ProfilePageContent />;
}

function ProfilePageContent() {
  return <div>Profile Page Content</div>;
}

export { ProfilePage };
