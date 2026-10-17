import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import AppShell from '../components/AppShell';
import ChatConversation from '../components/chat/ChatConversation';

export default function Chat() {
  const { appointmentId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  if (!appointmentId) {
    return <Navigate to="/profile/chats" replace />;
  }

  return (
    <AppShell tab="profile">
      <ChatConversation
        key={appointmentId}
        appointmentId={appointmentId}
        extras={location.state}
        onBack={() => {
          if (window.history.length > 1) navigate(-1);
          else navigate('/profile/chats');
        }}
      />
    </AppShell>
  );
}
