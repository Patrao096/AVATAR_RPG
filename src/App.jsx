import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import { ToastProvider } from './components/Toast';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Arena from './pages/Arena';
import Quests from './pages/Quests';
import Market from './pages/Market';
import Historia from './pages/Historia';
import Clans from './pages/Clans';
import BotCommands from './pages/BotCommands';
import Ranking from './pages/Ranking';
import Admin from './pages/Admin';
import Plans from './pages/Plans';
import Store from './pages/Store';
import { PaymentSuccess, PaymentFailed, PaymentPending } from './pages/PaymentResult';

const API = window.__API_URL__ || 'http://localhost:5000';

export function getToken() {
  return localStorage.getItem('avatar_token');
}

export function authHeaders() {
  return {
    Authorization: `Bearer ${getToken()}`,
    'Content-Type': 'application/json',
  };
}

// Helper: checa se o user é admin (qualquer um dos sinais conta)
export function isAdmin(user) {
  return !!(user?.isAdmin || user?.userRole === 'admin');
}

// ─── Callback do Discord ───
function AuthCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const error = params.get('error');

    if (error) {
      console.error('Erro no login Discord:', error);
      window.location.href = '/?error=' + error;
      return;
    }

    if (token) {
      localStorage.setItem('avatar_token', token);
      window.location.href = '/profile';
    } else {
      window.location.href = '/';
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="text-center text-white">
        <div className="text-6xl mb-4 animate-spin">🌍</div>
        <p className="text-lg">Autenticando com Discord...</p>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bannedMessage, setBannedMessage] = useState(null);

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }

    fetch(`${API}/api/character/me`, { headers: authHeaders() })
      .then(async r => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          // Se backend retornou banned, exibe tela específica
          if (r.status === 403 && data.banned) {
            setBannedMessage(data.error || 'Conta banida.');
            localStorage.removeItem('avatar_token');
            setLoading(false);
            return null;
          }
          throw new Error(`HTTP ${r.status}`);
        }
        return data;
      })
      .then(data => {
        if (!data) return;
        setUser(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Erro ao carregar usuário:', err.message);
        localStorage.removeItem('avatar_token');
        setLoading(false);
      });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('avatar_token');
    setUser(null);
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="text-center text-white">
          <div className="text-6xl mb-4 animate-spin">🌍</div>
          <p className="text-lg">Carregando...</p>
        </div>
      </div>
    );
  }

  // ─── Tela de banned ───
  if (bannedMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-6">
        <div className="max-w-md w-full bg-zinc-900 border-2 border-red-500/30 rounded-2xl p-8 text-center">
          <div className="text-6xl mb-4">🔨</div>
          <h1 className="text-2xl font-bold text-red-400 mb-3">Conta Banida</h1>
          <p className="text-zinc-300 text-sm mb-6">{bannedMessage}</p>
          <button onClick={() => { window.location.href = '/'; }}
            className="px-6 py-3 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/20 rounded-xl text-sm font-semibold">
            Voltar à página inicial
          </button>
        </div>
      </div>
    );
  }

  const PrivateRoute = ({ children }) =>
    user ? children : <Navigate to="/" replace />;

  // AdminRoute — aceita tanto isAdmin (dinâmico do .env) quanto userRole
  const AdminRoute = ({ children }) =>
    isAdmin(user) ? children : <Navigate to="/profile" replace />;

  // StoryGateRoute — se o usuário ainda não tem elemento, força ir pra História
  // (exceto /historia e /profile que ficam acessíveis)
  const StoryGateRoute = ({ children }) => {
    if (!user) return <Navigate to="/" replace />;
    if (user.needsStoryCompletion) return <Navigate to="/historia" replace />;
    return children;
  };

  return (
    <ToastProvider>
      <Router>
        <div className="min-h-screen bg-zinc-950 text-white">
          <Navbar user={user} onLogout={handleLogout} />
        <Routes>
          <Route path="/" element={<Home user={user} />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Profile e História sempre acessíveis */}
          <Route path="/profile" element={<PrivateRoute><Profile user={user} onLogout={handleLogout} /></PrivateRoute>} />
          <Route path="/historia" element={<PrivateRoute><Historia /></PrivateRoute>} />

          {/* Rotas bloqueadas até completar Cap. 1 */}
          <Route path="/arena"   element={<StoryGateRoute><Arena user={user} /></StoryGateRoute>} />
          <Route path="/quests"  element={<StoryGateRoute><Quests /></StoryGateRoute>} />
          <Route path="/market"  element={<StoryGateRoute><Market /></StoryGateRoute>} />
          <Route path="/clans"      element={<StoryGateRoute><Clans user={user} /></StoryGateRoute>} />
          <Route path="/clans/:id"   element={<StoryGateRoute><Clans user={user} /></StoryGateRoute>} />

          <Route path="/bot" element={<BotCommands />} />
          <Route path="/ranking" element={<Ranking />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/store" element={<Store />} />
          <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
          <Route path="/payment/success" element={<PaymentSuccess />} />
          <Route path="/payment/failed" element={<PaymentFailed />} />
          <Route path="/payment/pending" element={<PaymentPending />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </div>
      </Router>
    </ToastProvider>
  );
}

export default App;
