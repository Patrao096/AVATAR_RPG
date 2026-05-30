const CMDS = [
  { cat: '👤 Personagem', items: [
    ['/perfil [@usuário]', 'Exibe ficha completa com stats e elemento'],
    ['/status', 'HP, Chi e EXP atual do seu personagem'],
    ['/inventario', 'Lista todos os seus itens'],
    ['/habilidades', 'Skills equipadas e Chi disponível'],
  ]},
  { cat: '⚔️ Batalha', items: [
    ['/batalhar [@usuário]', 'Desafia outro jogador para duelo em turnos'],
    ['/arena', 'Entra na fila global para batalha aleatória'],
    ['/historico', 'Últimos 10 resultados de batalha'],
    ['/ranking [global/servidor]', 'Exibe o ranking de vitórias'],
  ]},
  { cat: '📜 Missões e Economia', items: [
    ['/missao', 'Pega ou verifica sua missão diária'],
    ['/saldo', 'Quantos Yuan você possui'],
    ['/mercado', 'Link direto para o Mercado Negro'],
    ['/transferir @usuário <valor>', 'Envia Yuan para outro jogador'],
    ['/loja', 'Acessa a loja de itens com dinheiro real'],
  ]},
  { cat: '🛡️ Clãs', items: [
    ['/cla info [nome]', 'Informações sobre um clã'],
    ['/cla entrar <nome>', 'Entra em um clã existente'],
    ['/cla criar <nome>', 'Cria novo clã (custo: 500 Yuan)'],
    ['/cla guerra', 'Status da guerra de clãs ativa'],
  ]},
  { cat: '📖 História', items: [
    ['/historia', 'Abre o modo história no dashboard'],
    ['/capitulo', 'Mostra progresso atual na saga'],
  ]},
  { cat: '⚙️ Admin', items: [
    ['/admin dar @usuário <yuan>', 'Dá Yuan a um usuário'],
    ['/admin ban @usuário', 'Bane um jogador do sistema'],
    ['/admin reset @usuário', 'Reseta o personagem de um usuário'],
  ], admin: true },
];

export default function BotCommands() {
  return (
    <div className="lg:ml-56 pt-16 lg:pt-0 pb-24 lg:pb-0 min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="w-14 h-14 bg-[#5865F2] rounded-2xl flex items-center justify-center text-3xl flex-shrink-0">🤖</div>
          <div>
            <h1 className="text-2xl font-bold">Comandos do Bot</h1>
            <p className="text-zinc-500 text-sm">Todos os slash commands disponíveis no Discord</p>
          </div>
          <div className="ml-auto flex items-center gap-2 bg-zinc-900 border border-teal-500/20 px-3 py-1.5 rounded-full flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-xs text-teal-400 font-semibold">Online</span>
          </div>
        </div>
        <div className="space-y-6">
          {CMDS.map(section => (
            <div key={section.cat}>
              <h2 className="font-semibold text-zinc-400 text-sm mb-3 uppercase tracking-wider">{section.cat}</h2>
              <div className="space-y-2">
                {section.items.map(([cmd, desc]) => (
                  <div key={cmd} className={`bg-zinc-900 border rounded-xl p-4 flex items-start gap-4 ${section.admin ? 'border-red-500/15' : 'border-white/5'}`}>
                    <code className={`text-sm font-bold flex-shrink-0 ${section.admin ? 'text-red-400' : 'text-teal-400'}`}>{cmd}</code>
                    <span className="text-sm text-zinc-400 leading-relaxed">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
