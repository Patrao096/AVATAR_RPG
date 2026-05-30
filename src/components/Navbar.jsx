import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';

const API = window.__API_URL__ || 'http://localhost:5000';

function userIsAdmin(user) {
  return !!(user?.isAdmin || user?.userRole === 'admin');
}

const ELEMENT_ICON = { Fogo: '🔥', 'Água': '💧', Terra: '🪨', Ar: '🌬️' };

const PRIMARY = [
  { to: '/profile',  icon: '👤', label: 'Perfil',   auth: true },
  { to: '/arena',    icon: '⚔️', label: 'Arena',    auth: true },
  { to: '/historia', icon: '📖', label: 'História', auth: true },
  { to: '/quests',   icon: '📜', label: 'Missões',  auth: true, notifyKey: 'quests' },
  { to: '/market',   icon: '🏪', label: 'Mercado',  auth: true },
];

const SECONDARY = [
  { to: '/clans',   icon: '🛡️', label: 'Clãs',    auth: true, notifyKey: 'clans' },
  { to: '/ranking', icon: '🏆', label: 'Ranking', auth: false },
  { to: '/store',   icon: '🏬', label: 'Loja',    auth: true },
  { to: '/plans',   icon: '💎', label: 'Planos',  auth: false },
  { to: '/bot',     icon: '🤖', label: 'Bot',     auth: false },
];

export default function Navbar({ user, onLogout }) {
  const loc = useLocation();
  const active = (path) => loc.pathname === path;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [questsBadge, setQuestsBadge] = useState(0);
  const [clanInvitesBadge, setClanInvitesBadge] = useState(0);
  const [clanSparBadge, setClanSparBadge] = useState(0);

  useEffect(() => { setDrawerOpen(false); }, [loc.pathname]);

  // Polling leve para o badge de missões urgentes
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('avatar_token');
    if (!token) return;
    const fetchBadge = async () => {
      try {
        const res = await fetch(`${API}/api/quest/all`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        // Considera urgente se tem missão ativa pronta para coletar OU expirando
        const urgent = (data.quests || []).filter(q =>
          q.progress >= q.maxProgress ||
          (q.timeRemainingMs != null && q.timeRemainingMs > 0 && q.timeRemainingMs < 2 * 60 * 60 * 1000)
        ).length;
        setQuestsBadge(urgent);
      } catch {}
    };
    fetchBadge();
    const id = setInterval(fetchBadge, 60_000); // 1min
    return () => clearInterval(id);
  }, [user]);

  // Polling para convites de clã pendentes
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('avatar_token');
    if (!token) return;
    const fetchInvites = async () => {
      try {
        const res = await fetch(`${API}/api/clan/invites`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setClanInvitesBadge(Array.isArray(data) ? data.length : 0);
      } catch {}
    };
    fetchInvites();
    const id = setInterval(fetchInvites, 30_000); // 30s
    return () => clearInterval(id);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('avatar_token');
    if (!token) return;
    const fetchSpar = async () => {
      try {
        const res = await fetch(`${API}/api/clan-spar/pending`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setClanSparBadge(Array.isArray(data) ? data.length : 0);
      } catch {}
    };
    fetchSpar();
    const id = setInterval(fetchSpar, 15_000); // 15s
    return () => clearInterval(id);
  }, [user]);

  const isAdmin = userIsAdmin(user);
  const visiblePrimary = PRIMARY.filter(l => !l.auth || user);
  const visibleSecondary = SECONDARY.filter(l => !l.auth || user);

  const getBadge = (key) => {
    if (key === 'quests') return questsBadge;
    if (key === 'clans')  return clanInvitesBadge + clanSparBadge;
    return 0;
  };

  return (
    <>
      {/* ═══════ DESKTOP SIDEBAR ═══════ */}
      <aside className="hidden lg:flex flex-col fixed top-0 left-0 bottom-0 w-56 bg-zinc-950/95 backdrop-blur-xl border-r border-white/5 z-50">
        {/* Logo */}
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-cyan-400 rounded-xl flex items-center justify-center text-zinc-900 font-bold text-lg shadow-lg shadow-teal-500/20">
              ☯
            </div>
            <div>
              <div className="font-bold text-sm tracking-wide">AVATAR RPG</div>
              <div className="text-[10px] text-zinc-500 flex items-center gap-1.5">
                <span className="live-dot"></span>
                <span>Global</span>
              </div>
            </div>
          </div>
        </div>

        {/* User card */}
        {user && (
          <div className="p-3 border-b border-white/5">
            <Link to="/profile" className="flex items-center gap-3 bg-zinc-900 hover:bg-zinc-800/80 rounded-xl p-3 transition-all border border-white/5 lift">
              <div className="relative w-10 h-10 flex-shrink-0">
                <img src={user.discordAvatar || 'https://via.placeholder.com/40'}
                  className="w-full h-full rounded-lg border border-teal-400/40" alt="" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{user.discordUsername}</div>
                <div className="text-xs text-teal-400 truncate">
                  {ELEMENT_ICON[user.element] || ''} {user.element || 'Sem elemento'} · Lv.{user.level}
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* Primary nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <div className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold px-3 mb-2">Principal</div>
          {visiblePrimary.map(l => (
            <NavLink key={l.to} link={l} active={active(l.to)} badge={getBadge(l.notifyKey)} />
          ))}

          <div className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold px-3 mb-2 mt-5">Mais</div>
          {visibleSecondary.map(l => (
            <NavLink key={l.to} link={l} active={active(l.to)} badge={getBadge(l.notifyKey)} />
          ))}

          {isAdmin && (
            <>
              <div className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold px-3 mb-2 mt-5">Admin</div>
              <Link to="/admin"
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                  ${active('/admin')
                    ? 'bg-red-500/15 text-red-400 border border-red-400/25'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}>
                <span>⚙️</span> Admin
              </Link>
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-white/5">
          {!user ? (
            <a href={`${API}/auth/discord`}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#5865F2] hover:bg-[#4752C4] rounded-xl text-sm font-semibold transition-all">
              <span>🎮</span> Entrar com Discord
            </a>
          ) : (
            <button onClick={onLogout}
              className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-sm font-semibold transition-all border border-red-500/20">
              ← Sair
            </button>
          )}
        </div>
      </aside>

      {/* ═══════ MOBILE TOPBAR ═══════ */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-zinc-900/92 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <button onClick={() => setDrawerOpen(true)} aria-label="Menu"
          className="text-xl text-zinc-300 hover:text-white p-1 -ml-1">
          ☰
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-cyan-400 rounded-lg flex items-center justify-center text-zinc-900 font-bold text-base shadow-md shadow-teal-500/15">
            ☯
          </div>
          <span className="font-bold text-sm tracking-wide truncate">AVATAR RPG</span>
        </div>
        {user ? (
          <Link to="/store" className="flex items-center gap-1 bg-zinc-800/70 hover:bg-zinc-800 rounded-full px-3 py-1.5 transition-all border border-white/5">
            <span className="text-xs">💰</span>
            <span className="text-xs font-bold text-amber-400 font-mono">{user.money ?? 0}</span>
          </Link>
        ) : (
          <a href={`${API}/auth/discord`}
            className="text-xs bg-[#5865F2] hover:bg-[#4752C4] px-3 py-1.5 rounded-full font-semibold transition-all">
            Login
          </a>
        )}
      </header>

      {/* ═══════ MOBILE DRAWER ═══════ */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setDrawerOpen(false); }}>
          <aside className="w-72 max-w-[85vw] h-full bg-zinc-950 border-r border-white/5 overflow-y-auto pb-safe">
            <div className="p-4 border-b border-white/5 flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-teal-400 to-cyan-400 rounded-xl flex items-center justify-center text-zinc-900 font-bold">
                ☯
              </div>
              <div className="flex-1">
                <div className="font-bold text-sm">AVATAR RPG</div>
                <div className="text-[10px] text-zinc-500 flex items-center gap-1.5">
                  <span className="live-dot"></span>
                  <span>Online</span>
                </div>
              </div>
              <button onClick={() => setDrawerOpen(false)}
                className="text-xl text-zinc-400 hover:text-white p-1" aria-label="Fechar menu">
                ✕
              </button>
            </div>

            {user && (
              <div className="p-3 border-b border-white/5">
                <Link to="/profile" className="flex items-center gap-3 bg-zinc-900 rounded-xl p-3 border border-white/5">
                  <img src={user.discordAvatar || 'https://via.placeholder.com/40'}
                    className="w-10 h-10 rounded-lg border border-teal-400/40" alt="" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{user.discordUsername}</div>
                    <div className="text-xs text-teal-400 truncate">
                      {ELEMENT_ICON[user.element] || ''} {user.element || '—'} · Lv.{user.level}
                    </div>
                  </div>
                </Link>
              </div>
            )}

            <nav className="p-3 space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold px-3 mb-2">Principal</div>
              {visiblePrimary.map(l => (
                <NavLink key={l.to} link={l} active={active(l.to)} badge={getBadge(l.notifyKey)} mobile />
              ))}
              <div className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold px-3 mb-2 mt-5">Mais</div>
              {visibleSecondary.map(l => (
                <NavLink key={l.to} link={l} active={active(l.to)} badge={getBadge(l.notifyKey)} mobile />
              ))}
              {isAdmin && (
                <>
                  <div className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold px-3 mb-2 mt-5">Admin</div>
                  <Link to="/admin"
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all min-h-[48px]
                      ${active('/admin')
                        ? 'bg-red-500/15 text-red-400 border border-red-400/25'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}>
                    <span>⚙️</span> Admin
                  </Link>
                </>
              )}
            </nav>

            <div className="p-3 border-t border-white/5 mt-2">
              {!user ? (
                <a href={`${API}/auth/discord`}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-[#5865F2] hover:bg-[#4752C4] rounded-xl text-sm font-semibold transition-all">
                  <span>🎮</span> Entrar com Discord
                </a>
              ) : (
                <button onClick={onLogout}
                  className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-sm font-semibold transition-all border border-red-500/20">
                  ← Sair
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* ═══════ MOBILE BOTTOM NAV ═══════ */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-900/95 backdrop-blur-xl border-t border-white/5 grid grid-cols-5 pb-safe">
        {visiblePrimary.map(l => {
          const isActive = active(l.to);
          const badge = getBadge(l.notifyKey);
          return (
            <Link key={l.to} to={l.to}
              className={`flex flex-col items-center justify-center py-2.5 relative transition-colors
                ${isActive ? 'text-teal-400' : 'text-zinc-500'}`}>
              {isActive && (
                <span className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-teal-400 rounded-b-full"
                  style={{ boxShadow: '0 0 8px #2dd4bf' }} />
              )}
              <span className="text-xl leading-none relative">
                {l.icon}
                {badge > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] bg-amber-400 text-zinc-900 text-[9px] font-bold rounded-full px-1 flex items-center justify-center"
                    style={{ boxShadow: '0 0 6px rgba(251,191,36,0.6)' }}>
                    {badge}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-semibold mt-1">{l.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Desktop offset */}
      <div className="hidden lg:block w-56 flex-shrink-0" />
    </>
  );
}

function NavLink({ link, active, mobile = false, badge = 0 }) {
  return (
    <Link to={link.to}
      className={`flex items-center gap-3 px-3 ${mobile ? 'py-3 min-h-[48px]' : 'py-2.5'} rounded-xl text-sm font-medium transition-all relative
        ${active
          ? 'bg-teal-400/12 text-teal-400 border border-teal-400/25'
          : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}>
      <span className="text-base">{link.icon}</span>
      <span className="flex-1">{link.label}</span>
      {badge > 0 && (
        <span className="min-w-[18px] h-[18px] bg-amber-400 text-zinc-900 text-[10px] font-bold rounded-full px-1.5 flex items-center justify-center"
          style={{ boxShadow: '0 0 6px rgba(251,191,36,0.5)' }}>
          {badge}
        </span>
      )}
    </Link>
  );
}
