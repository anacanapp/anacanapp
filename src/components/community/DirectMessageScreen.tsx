import ConversationScreen from '@/components/chat/ConversationScreen';

interface DirectMessageScreenProps {
  userId: string;
  userName: string;
  userAvatar: string | null;
  onBack: () => void;
}

export default function DirectMessageScreen({ userId, userName, userAvatar, onBack }: DirectMessageScreenProps) {
  return <ConversationScreen kind="direct" target={userId} title={userName} avatar={userAvatar} onBack={onBack} />;
}
