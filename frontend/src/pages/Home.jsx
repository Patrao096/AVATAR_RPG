import DiscordLinks from '../components/DiscordLinks';

const API = window.__API_URL__ || 'http://localhost:5000';

export default function Home({ user }) {
  if (user) {
    window.location.href = '/profile';
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center pt-16 pb-24 lg:pt-0 lg:pb-0 page-enter">
      <div className="text-7xl mb-6 animate-bounce">🌍</div>
      <h1 className="text-4xl lg:text-6xl font-bold mb-4 bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
        AVATAR RPG
      </h1>
      <p className="text-zinc-400 text-lg max-w-md mb-10">
        Escolha seu elemento, batalhe contra jogadores do mundo todo e viva a saga do Avatar.
      </p>
      <a
        href={`${API}/auth/discord`}
        className="flex items-center gap-3 bg-[#5865F2] hover:bg-[#4752C4] px-8 py-4 rounded-2xl font-bold text-lg transition-all hover:scale-105 shadow-xl shadow-indigo-500/25"
      >
        <span className="text-2xl">🎮</span> Entrar com Discord
      </a>
      <div className="grid grid-cols-3 gap-6 mt-16 max-w-md text-center">
        <div><div className="text-3xl font-bold text-teal-400">8.4k+</div><div className="text-zinc-500 text-sm">Jogadores</div></div>
        <div><div className="text-3xl font-bold text-amber-400">12k+</div><div className="text-zinc-500 text-sm">Batalhas</div></div>
        <div><div className="text-3xl font-bold text-purple-400">5</div><div className="text-zinc-500 text-sm">Capítulos</div></div>
      </div>

      {}
      <div className="w-full max-w-md mt-10">
        <DiscordLinks />
      </div>
    </div>
  );
}
