# Roadmap — futuras atualizações

Sugestões de evolução para o site e o bot, organizadas por esforço e impacto. Não há nada obrigatório aqui; é um mapa para priorizar o que fizer sentido.

## Prioridade alta (impacto rápido, esforço baixo a médio)

### Site
- Banner de evento de clã ativo no topo do perfil e da home, reaproveitando o endpoint `/api/clan/war/active`. Hoje o evento só aparece dentro da aba de clãs.
- Indicador de "loja diária renova em X" visível fora da página da loja, para lembrar o jogador de voltar.
- Notificações in-app de missões prontas para resgatar e convites de clã pendentes (já existe o polling no Navbar; falta o aviso visual consolidado).
- Tela de histórico de batalhas com filtro por tipo (treino, PvP, amistoso de clã) e resultado.

### Bot
- Aviso de evento de clã ativo na home do painel, com botão de atalho para o leaderboard (a home já recebe o dado; falta destacar quando há prêmio em disputa).
- Resumo diário opcional por DM: missões prontas, loja do dia e status do evento. Exige a intent de DM e consentimento do usuário.
- Atalho "comprar de novo" na loja para repetir a última compra com um clique.

## Prioridade média (recursos novos)

### Compartilhados (backend + os dois clientes)
- Sistema de amizades: lista de amigos, status online e desafio direto sem precisar do mesmo clã.
- Eventos sazonais com loja temática e recompensas exclusivas por período.
- Conquistas e títulos exibíveis no perfil (primeiro craft, primeira vitória ranqueada, top 10 do ranking, etc.).
- Chat de clã com histórico paginado, acessível no site e no bot.

### Site
- Editor visual de loadout com pré-visualização de dano e sinergia entre skills equipadas.
- Página pública de clã com vitrine de membros, conquistas e histórico de eventos.

### Bot
- Paginação nos selects que passam de 25 itens (limite do Discord), com botões de página anterior e próxima.
- Modal de confirmação de quantidade também na venda do mercado quando o item é empilhável (já implementado parcialmente; estender para todos os fluxos de compra).

## Prioridade baixa (visão de longo prazo)

- Modo cooperativo: dois jogadores do mesmo clã contra um boss de alta dificuldade.
- Torneios automatizados com chaveamento, inscrições por janela de tempo e premiação em Yuan.
- Painel de métricas para admin no site: curva de retenção, itens mais vendidos, distribuição de ELO.
- Internacionalização (pt-BR e en) com seleção de idioma por usuário.
- Webhooks de eventos para o servidor do Discord: anúncio automático quando um evento de clã começa ou termina.

## Dívidas técnicas que vale endereçar

- Testes automatizados: o projeto não tem suíte de testes. Começar pelos cálculos de batalha e pelas rotas críticas (compra, venda, premiação de evento) reduz risco de regressão.
- Validação de schema nas respostas da API consumidas pelo bot, para falhar de forma clara quando o backend mudar um campo.
- Centralizar os textos de UI do bot em um único arquivo, facilitando ajustes de tom e a futura tradução.
- Cache do bot: hoje é em memória por processo. Em múltiplas instâncias, migrar para um cache compartilhado (Redis) evita inconsistências.
