import { useNavigate } from 'react-router-dom';
import ModeratorPanel from '@/components/moderation/ModeratorPanel';
export default function ModeratorPage() { const navigate = useNavigate(); return <ModeratorPanel onBack={() => navigate('/')} />; }
