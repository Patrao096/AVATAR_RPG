// frontend/src/components/DiscordLinks.jsx
// Carrega as URLs do endpoint público /api/config (admin-configuráveis via env).
import { useState, useEffect } from 'react';

const API = window.__API_URL__ || 'http://localhost:5000';

export function useDiscordLinks() {
  const [config, setConfig] = useState({ supportInvite: null, botInvite: null });
  useEffect(() => {
    fetch(`${API}/api/config`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setConfig(d); })
      .catch(() => {});
  }, []);
  return config;
}

/**
 * Card compacto pra colocar em Home/Profile.
 * variant: 'card' (com fundo + borda) | 'inline' (só os botões)
 */
export default function DiscordLinks({ variant = 'card' }) {
  const { supportInvite, botInvite } = useDiscordLinks();

  // Se nenhum link configurado, não renderiza nada (admin não setou env vars)
  if (!supportInvite && !botInvite) return null;

  const buttons = (
    <div className="flex flex-col sm:flex-row gap-2">
      {supportInvite && (
        <a href={supportInvite} target="_blank" rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5
                     bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-400/30
                     rounded-xl text-sm font-semibold text-indigo-200 transition">
          <span className="text-lg">💬</span>
          <span>Servidor de Suporte</span>
        </a>
      )}
      {botInvite && (
        <a href={botInvite} target="_blank" rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5
                     bg-purple-500/15 hover:bg-purple-500/25 border border-purple-400/30
                     rounded-xl text-sm font-semibold text-purple-200 transition">
          <span className="text-lg">🤖</span>
          <span>Adicionar Bot ao seu Servidor</span>
        </a>
      )}
    </div>
  );

  if (variant === 'inline') return buttons;

  return (
    <div className="bg-gradient-to-br from-indigo-500/5 to-purple-500/5
                    border border-indigo-500/20 rounded-2xl p-4">
      <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-wider mb-3
                     flex items-center gap-2">
        <span>🌐</span> Comunidade & Bot
      </h3>
      {buttons}
      <p className="text-[10px] text-zinc-500 mt-2 text-center">
        Tire dúvidas, reporte bugs ou jogue direto pelo Discord.
      </p>
    </div>
  );
}
