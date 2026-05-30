// backend/src/data/story-chapters.js
// Conteúdo dos 10 capítulos do Modo História.
//
// Cada capítulo tem:
//   - title, description
//   - scenes[]: cada cena tem título, texto, choices ou battle
//   - Cenas de batalha: { type: 'battle', title, text, opponent: {...}, onWin/onLose tags }

export const STORY = {
  // CAPÍTULO 1 — O Despertar do Elemento
  1: {
    title: 'O Despertar do Elemento',
    description: 'Suas escolhas neste capítulo irão definir seu elemento para sempre.',
    scenes: [
      {
        title: 'O Despertar',
        text: 'O vento sopra suavemente enquanto você abre os olhos pela primeira vez no Templo do Ar. Você sente um poder estranho fluindo por dentro de você — mas ainda sem forma. Um monge idoso se aproxima com um sorriso.\n\n— "Jovem, você foi escolhido. Mas seu elemento ainda precisa despertar. Ele responderá ao seu coração, não à sua vontade."\n\nComo você reage?',
        choices: [
          { tag: 'wise',       element: 'Ar',    label: '🙏 Aceito meu destino com humildade' },
          { tag: 'aggressive', element: 'Fogo',  label: '💪 Estou pronto para treinar agora!' },
          { tag: 'fearful',    element: 'Terra', label: '😨 Fico hesitante — e se eu falhar?' },
          { tag: 'wise',       element: 'Água',  label: '🌊 Deixo o tempo fluir e vejo o que acontece' },
        ],
      },
      {
        title: 'Os Quatro Altares',
        text: 'O monge te leva a uma câmara antiga com quatro altares brilhando suavemente: uma chama dançante, uma esfera d\'água pulsante, uma pedra zumbindo, e um redemoinho de vento. Ele diz:\n\n— "Não toque ainda. Apenas observe. Qual chama você?"\n\n⚠️ Esta escolha tem PESO TRIPLO na definição do seu elemento.',
        choices: [
          { tag: 'aggressive', element: 'Fogo',  elementWeight: 3, label: '🔥 A chama — ela arde como meu coração' },
          { tag: 'wise',       element: 'Água',  elementWeight: 3, label: '💧 A água — ela flui como meus pensamentos' },
          { tag: 'fearful',    element: 'Terra', elementWeight: 3, label: '🪨 A pedra — ela é sólida como meu refúgio' },
          { tag: 'wise',       element: 'Ar',    elementWeight: 3, label: '🌬️ O vento — ele é livre como minha alma' },
        ],
      },
      {
        title: 'O Juramento',
        text: 'O elemento que você observou começa a ressoar com sua respiração. O monge assente, solene.\n\n— "Antes que o elemento se ligue a você, faça um juramento. O que você fará com esse poder?"',
        choices: [
          { tag: 'wise',       element: 'Água',  label: '☮️ Proteger os inocentes acima de tudo' },
          { tag: 'aggressive', element: 'Fogo',  label: '⚔️ Derrotar qualquer um que me oponha' },
          { tag: 'fearful',    element: 'Terra', label: '🏡 Defender o que é meu e fugir do desnecessário' },
          { tag: 'wise',       element: 'Ar',    label: '🦅 Viajar e explorar o mundo livremente' },
        ],
      },
      {
        title: 'O Teste Final',
        text: 'De repente, bandidos da Nação do Fogo invadem o templo. O monge cai ferido. Você ainda não pode dobrar — mas algo dentro de você está prestes a acordar. O que você faz NESSE instante decisivo?',
        choices: [
          { tag: 'aggressive', element: 'Fogo',  label: '⚡ Enfrento os bandidos com fúria crua' },
          { tag: 'wise',       element: 'Água',  label: '🛡️ Protejo o monge e busco aliados' },
          { tag: 'fearful',    element: 'Terra', label: '🏃 Escondo o monge e fujo para salvar a ambos' },
          { tag: 'aggressive', element: 'Ar',    label: '💨 Surpreendo com velocidade e astúcia' },
        ],
      },
    ],
  },

  // CAPÍTULO 2 — A Guerra das Nações  (com batalha!)
  2: {
    title: 'A Guerra das Nações',
    description: 'Enfrente as forças da Nação do Fogo. Inclui sua primeira batalha de história.',
    scenes: [
      {
        title: 'A Floresta',
        text: 'Uma patrulha da Nação do Fogo bloqueia seu caminho.\n\n— "Alto aí, Dobrador!"\n\nO que você faz?',
        choices: [
          { tag: 'aggressive', label: '⚔️ Enfrentar com Dobra' },
          { tag: 'fearful',    label: '💨 Escapar pelo vento' },
          { tag: 'wise',       label: '🤝 Tentar negociar' },
        ],
      },
      {
        type: 'battle',
        title: 'Soldado da Nação do Fogo',
        text: 'A negociação falhou. Um soldado de elite avança contra você.\n\n⚔️ BATALHA INICIANDO...',
        opponent: {
          name: 'Soldado Imperial',
          element: 'Fogo',
          icon: '🔥',
          level: 3,
          attack: 28,
          defense: 18,
          maxHp: 110,
          maxChi: 50,
        },
        rewardOnWin: { exp: 80, yuan: 30 },
        rewardOnLose: { exp: 20, yuan: 5 },
      },
      {
        title: 'O Refugiado',
        text: 'Uma criança da Nação do Fogo pede abrigo. Ela foi exilada por não dobrar fogo.',
        choices: [
          { tag: 'wise',       label: '🫂 Acolher — todos merecem paz' },
          { tag: 'fearful',    label: '🚪 Recusar — é perigoso' },
          { tag: 'aggressive', label: '❓ Interrogar antes de decidir' },
        ],
      },
      {
        title: 'O General',
        text: 'Um general da Nação do Fogo oferece trégua em troca de sua lealdade.',
        choices: [
          { tag: 'aggressive', label: '💢 Recuso e ataco' },
          { tag: 'wise',       label: '🕊️ Aceito se ele libertar os prisioneiros' },
          { tag: 'fearful',    label: '🤐 Finjo aceitar para escapar' },
        ],
      },
      {
        title: 'A Vitória',
        text: 'A batalha termina. Prisioneiros suplicam por clemência.',
        choices: [
          { tag: 'wise',       label: '⚖️ Julgo justamente cada caso' },
          { tag: 'aggressive', label: '⚔️ Pena máxima aos líderes' },
          { tag: 'fearful',    label: '🚪 Libero todos e sigo em frente' },
        ],
      },
    ],
  },

  // CAPÍTULO 3 — O Espírito do Avatar
  3: {
    title: 'O Espírito do Avatar',
    description: 'Entre no mundo espiritual e confronte seus medos mais profundos.',
    scenes: [
      {
        title: 'O Portal',
        text: 'Você atravessa o portal espiritual. Criaturas de luz e sombra circulam ao seu redor. Um espírito antigo bloqueia seu caminho.\n\n— "Prove que seu coração é puro."',
        choices: [
          { tag: 'wise',       label: '🧘 Meditar e mostrar paz interior' },
          { tag: 'aggressive', label: '🌟 Usar seu poder para impressionar' },
          { tag: 'fearful',    label: '💬 Conversar honestamente' },
        ],
      },
      {
        title: 'O Reflexo',
        text: 'Um espelho espiritual mostra uma versão sombria de você. Ela ataca.',
        choices: [
          { tag: 'wise',       label: '☯️ Aceito essa parte de mim' },
          { tag: 'aggressive', label: '💥 Destruo sem piedade' },
          { tag: 'fearful',    label: '🛡️ Fujo do espelho' },
        ],
      },
      {
        type: 'battle',
        title: 'Sombra do Avatar',
        text: 'A versão sombria de você se materializa. Ela conhece todas as suas fraquezas.\n\n👻 BATALHA ESPIRITUAL!',
        opponent: {
          name: 'Sombra do Avatar',
          element: 'Neutro',
          icon: '👻',
          level: 8,
          attack: 38,
          defense: 25,
          maxHp: 140,
          maxChi: 70,
        },
        rewardOnWin: { exp: 200, yuan: 80 },
        rewardOnLose: { exp: 40, yuan: 10 },
      },
      {
        title: 'A Memória',
        text: 'Você revive um trauma antigo. O espírito pergunta: "O que você faria diferente?"',
        choices: [
          { tag: 'wise',       label: '🕊️ Perdoaria a todos' },
          { tag: 'aggressive', label: '⚡ Teria sido mais forte' },
          { tag: 'fearful',    label: '🙈 Não teria me envolvido' },
        ],
      },
      {
        title: 'O Avatar Anterior',
        text: 'Um Avatar do passado aparece e oferece um conselho.',
        choices: [
          { tag: 'wise',       label: '📚 Ouço com reverência' },
          { tag: 'aggressive', label: '🤺 Desafio-o para aprender lutando' },
          { tag: 'fearful',    label: '🙇 Agradeço mas me sinto indigno' },
        ],
      },
      {
        title: 'O Retorno',
        text: 'De volta ao mundo físico, você sente algo novo dentro de você.',
        choices: [
          { tag: 'wise',       label: '🌟 Aceito essa transformação' },
          { tag: 'aggressive', label: '💪 Vou usar esse poder nas batalhas' },
          { tag: 'fearful',    label: '😟 Tenho receio do que me tornei' },
        ],
      },
    ],
  },

  // CAPÍTULO 4 — O Senhor do Fogo
  4: {
    title: 'O Senhor do Fogo',
    description: 'O confronto com o Senhor do Fogo se aproxima. Inclui batalha contra Azula.',
    scenes: [
      {
        title: 'O Palácio',
        text: 'As portas do palácio do Senhor do Fogo se abrem. Guardas imperiais bloqueiam seu caminho.',
        choices: [
          { tag: 'aggressive', label: '💥 Abro caminho com força' },
          { tag: 'wise',       label: '🎭 Me disfarço e passo despercebido' },
          { tag: 'fearful',    label: '🗝️ Procuro uma entrada secreta' },
        ],
      },
      {
        title: 'A Irmã',
        text: 'Azula, princesa do Fogo, aparece. Ela parece abalada.\n\n— "Você veio até mim..."',
        choices: [
          { tag: 'wise',       label: '🤝 Ofereço a ela uma chance de paz' },
          { tag: 'aggressive', label: '⚔️ Luto contra ela imediatamente' },
          { tag: 'fearful',    label: '🏃 Desvio dela — ela é imprevisível' },
        ],
      },
      {
        type: 'battle',
        title: 'Azula',
        text: 'Azula sorri perigosamente. Chamas azuis dançam em suas mãos.\n\n⚡ DUELO COM A PRINCESA DO FOGO!',
        opponent: {
          name: 'Princesa Azula',
          element: 'Fogo',
          icon: '⚡',
          level: 12,
          attack: 50,
          defense: 22,
          maxHp: 160,
          maxChi: 90,
        },
        rewardOnWin: { exp: 350, yuan: 150 },
        rewardOnLose: { exp: 70, yuan: 20 },
      },
      {
        title: 'O Cometa',
        text: 'O cometa de Sozin está no céu. O poder do Fogo está em seu ápice.',
        choices: [
          { tag: 'aggressive', label: '🔥 Uso o momento para atacar tudo' },
          { tag: 'wise',       label: '🛡️ Defendo os civis primeiro' },
          { tag: 'fearful',    label: '⏳ Espero o cometa passar' },
        ],
      },
      {
        title: 'O Conselho',
        text: 'O monge aparece em visão: "Existem formas de vencer sem matar."',
        choices: [
          { tag: 'wise',       label: '🌿 Escuto — deve haver outro caminho' },
          { tag: 'aggressive', label: '💢 Ignoro — Ozai precisa cair' },
          { tag: 'fearful',    label: '😓 Peço orientação — estou perdido' },
        ],
      },
      {
        title: 'A Decisão',
        text: 'Ozai está derrotado aos seus pés. O que você faz?',
        choices: [
          { tag: 'wise',       label: '⚖️ Retiro suas dobras — fim da guerra' },
          { tag: 'aggressive', label: '⚡ Acabo com ele' },
          { tag: 'fearful',    label: '🏃 Deixo-o fugir — não quero o peso' },
        ],
      },
    ],
  },

  // CAPÍTULO 5 — O Fim do Ciclo (último free!)
  5: {
    title: 'O Fim do Ciclo',
    description: 'O destino do mundo está em suas mãos. (Último capítulo gratuito.)',
    scenes: [
      { title: 'A Coroação',   text: 'O mundo te aclama. Mas um novo líder precisa surgir para a Nação do Fogo.', choices: [{ tag: 'wise', label: '👑 Coroar Zuko' }, { tag: 'aggressive', label: '⚔️ Assumir o trono eu mesmo' }, { tag: 'fearful', label: '🗳️ Deixar o povo decidir' }] },
      { title: 'O Templo',     text: 'O Templo do Ar precisa ser reconstruído.', choices: [{ tag: 'wise', label: '🏗️ Liderar a reconstrução' }, { tag: 'aggressive', label: '💪 Delegar e continuar combatendo remanescentes' }, { tag: 'fearful', label: '🙏 Rezar pelos que morreram' }] },
      { title: 'O Amor',       text: 'Alguém especial espera por sua resposta.', choices: [{ tag: 'wise', label: '💕 Aceito — equilíbrio com amor' }, { tag: 'aggressive', label: '⚔️ Recuso — meu dever vem primeiro' }, { tag: 'fearful', label: '🤐 Adio a conversa' }] },
      { title: 'O Inimigo',    text: 'Um antigo inimigo pede perdão.', choices: [{ tag: 'wise', label: '🕊️ Perdoo — é o caminho do Avatar' }, { tag: 'aggressive', label: '⚖️ Prisão perpétua' }, { tag: 'fearful', label: '🚪 Mando embora — não quero envolvimento' }] },
      { title: 'O Fim',        text: 'Seu ciclo como Avatar se aproxima do fim. Qual sua mensagem final?', choices: [{ tag: 'wise', label: '☯️ Equilíbrio é o maior poder' }, { tag: 'aggressive', label: '⚔️ Lutem por aquilo que amam' }, { tag: 'fearful', label: '🙏 Que outros sejam mais corajosos que eu' }] },
    ],
  },

  // CAPÍTULO 6 — O Despertar Ancestral (Premium)
  6: {
    title: 'O Despertar Ancestral',
    description: 'Os antigos dragões dormem nas montanhas. Será que despertarão para você?',
    scenes: [
      {
        title: 'A Trilha',
        text: 'Você sobe a montanha sagrada onde os Dragões Mestres ainda existem.',
        choices: [
          { tag: 'wise',       label: '🧘 Sigo respeitosamente, em silêncio' },
          { tag: 'aggressive', label: '⚔️ Vou armado, pronto p/ qualquer coisa' },
          { tag: 'fearful',    label: '🙏 Peço bênção dos espíritos primeiro' },
        ],
      },
      {
        title: 'O Templo Esquecido',
        text: 'Você encontra um templo coberto por raízes. Hieróglifos antigos contam de uma técnica perdida.',
        choices: [
          { tag: 'wise',       label: '📚 Estudo cuidadosamente os símbolos' },
          { tag: 'aggressive', label: '💢 Quebro a porta para entrar' },
          { tag: 'fearful',    label: '🤔 Procuro outra entrada' },
        ],
      },
      {
        type: 'battle',
        title: 'Guardião do Templo',
        text: 'Uma estátua de pedra ganha vida e bloqueia seu caminho!\n\n🗿 GUARDIÃO ANCESTRAL!',
        opponent: {
          name: 'Golem do Templo',
          element: 'Terra',
          icon: '🗿',
          level: 18,
          attack: 55,
          defense: 50,
          maxHp: 220,
          maxChi: 60,
        },
        rewardOnWin: { exp: 500, yuan: 200 },
        rewardOnLose: { exp: 100, yuan: 30 },
      },
      {
        title: 'O Dragão',
        text: 'Um dragão massivo desperta no santuário interior. Ele examina sua alma.',
        choices: [
          { tag: 'wise',       label: '🙇 Me prostro com humildade' },
          { tag: 'aggressive', label: '🔥 Demonstro minha força' },
          { tag: 'fearful',    label: '🥺 Tremo, mas não fujo' },
        ],
      },
      {
        title: 'A Bênção',
        text: 'O dragão ronrona. "Você merece a Fúria Ancestral. Use-a com sabedoria."',
        choices: [
          { tag: 'wise',       label: '🙏 Aceito como dádiva sagrada' },
          { tag: 'aggressive', label: '💪 Aceito para ser mais forte' },
          { tag: 'fearful',    label: '🤔 Aceito, mas com receio do peso' },
        ],
      },
    ],
  },

  // CAPÍTULO 7 — O Cometa Retorna
  7: {
    title: 'O Cometa Retorna',
    description: 'O cometa de Sozin volta após 100 anos. Uma nova era de poder começa.',
    scenes: [
      {
        title: 'O Aviso',
        text: 'Astrólogos preveem: o cometa retornará em 7 dias. Dobradores de fogo se tornarão imparáveis nesse período.',
        choices: [
          { tag: 'wise',       label: '🛡️ Reuno aliados em todas as nações' },
          { tag: 'aggressive', label: '⚡ Treino sem parar até o dia' },
          { tag: 'fearful',    label: '🏠 Evacuo civis das zonas perigosas' },
        ],
      },
      {
        title: 'A Conspiração',
        text: 'Um grupo radical da Nação do Fogo planeja usar o cometa para destruir os outros povos.',
        choices: [
          { tag: 'aggressive', label: '⚔️ Ataco a base deles primeiro' },
          { tag: 'wise',       label: '🕵️ Investigo silenciosamente' },
          { tag: 'fearful',    label: '🚨 Aviso autoridades imediatamente' },
        ],
      },
      {
        type: 'battle',
        title: 'Líder Radical',
        text: 'Você confronta o líder do grupo radical no momento exato em que o cometa surge no horizonte.\n\n☄️ DUELO SOB O COMETA!',
        opponent: {
          name: 'Magus do Cometa',
          element: 'Fogo',
          icon: '☄️',
          level: 25,
          attack: 75,
          defense: 35,
          maxHp: 280,
          maxChi: 130,
        },
        rewardOnWin: { exp: 800, yuan: 350 },
        rewardOnLose: { exp: 150, yuan: 50 },
      },
      {
        title: 'A Fúria do Céu',
        text: 'Com o cometa direto sobre vocês, você sente sua dobra ressoar com energia cósmica.',
        choices: [
          { tag: 'aggressive', label: '🔥 Canalizo todo o poder no oponente' },
          { tag: 'wise',       label: '☯️ Uso o poder para selar as chamas malignas' },
          { tag: 'fearful',    label: '🛡️ Crio um escudo protetor' },
        ],
      },
      {
        title: 'O Após',
        text: 'O cometa passa. A energia se dissipa. As perdas precisam ser contadas.',
        choices: [
          { tag: 'wise',       label: '⚖️ Lidero os esforços de reconstrução' },
          { tag: 'aggressive', label: '⚔️ Caço os sobreviventes radicais' },
          { tag: 'fearful',    label: '🙏 Honro os mortos e me retiro' },
        ],
      },
    ],
  },

  // CAPÍTULO 8 — A Revolta dos Quatro Reinos
  8: {
    title: 'A Revolta dos Quatro Reinos',
    description: 'Os quatro reinos entram em conflito. Sua liderança será testada.',
    scenes: [
      {
        title: 'A Reunião',
        text: 'Líderes das quatro nações se reúnem. Acusações voam em todas as direções.',
        choices: [
          { tag: 'wise',       label: '🕊️ Tento mediar com equilíbrio' },
          { tag: 'aggressive', label: '👑 Imponho minha autoridade de Avatar' },
          { tag: 'fearful',    label: '🤐 Escuto antes de tomar lado' },
        ],
      },
      {
        title: 'A Traição',
        text: 'Um aliado próximo está secretamente ajudando uma das nações em revolta.',
        choices: [
          { tag: 'aggressive', label: '⚔️ Confronto-o imediatamente' },
          { tag: 'wise',       label: '🧠 Coleto provas antes de agir' },
          { tag: 'fearful',    label: '😢 Me afasto dele em silêncio' },
        ],
      },
      {
        type: 'battle',
        title: 'Aliado Traidor',
        text: 'A confrontação se torna inevitável. Seu antigo amigo agora é um inimigo formidável.\n\n💔 BATALHA DOLOROSA!',
        opponent: {
          name: 'Antigo Aliado',
          element: 'Ar',
          icon: '🗡️',
          level: 30,
          attack: 85,
          defense: 50,
          maxHp: 320,
          maxChi: 140,
        },
        rewardOnWin: { exp: 1100, yuan: 500 },
        rewardOnLose: { exp: 200, yuan: 70 },
      },
      {
        title: 'A Fortaleza',
        text: 'Você lidera o cerco da fortaleza rebelde. Civis estão dentro.',
        choices: [
          { tag: 'wise',       label: '⏳ Cerco lento, evacuação primeiro' },
          { tag: 'aggressive', label: '💥 Ataque rápido — vitória decisiva' },
          { tag: 'fearful',    label: '🚪 Negocio rendição com ultimato' },
        ],
      },
      {
        title: 'A Justiça',
        text: 'A revolta acaba. Os líderes capturados aguardam julgamento.',
        choices: [
          { tag: 'wise',       label: '⚖️ Julgamento público e justo' },
          { tag: 'aggressive', label: '⚔️ Pena máxima — exemplo aos demais' },
          { tag: 'fearful',    label: '🌿 Misericórdia — exílio em vez de morte' },
        ],
      },
      {
        title: 'O Renascimento',
        text: 'As nações precisam de uma nova ordem. Sua palavra terá peso histórico.',
        choices: [
          { tag: 'wise',       label: '🤝 Conselho compartilhado entre os 4 povos' },
          { tag: 'aggressive', label: '👑 Império unificado sob meu comando' },
          { tag: 'fearful',    label: '🏠 Cada nação se governa, eu medeio quando preciso' },
        ],
      },
    ],
  },

  // CAPÍTULO 9 — Os Espíritos Furiosos
  9: {
    title: 'Os Espíritos Furiosos',
    description: 'O mundo espiritual está desestabilizado. Você precisa equilibrar as duas dimensões.',
    scenes: [
      {
        title: 'A Ruptura',
        text: 'Espíritos das florestas começam a invadir cidades, devorando dobradores.',
        choices: [
          { tag: 'wise',       label: '🌿 Vou ao mundo espiritual investigar' },
          { tag: 'aggressive', label: '⚔️ Caço os espíritos invasores' },
          { tag: 'fearful',    label: '🛡️ Fortifico cidades primeiro' },
        ],
      },
      {
        title: 'A Mãe Espírito',
        text: 'No mundo espiritual, encontra a Mãe Espírito sangrando. "Vocês envenenaram nossas terras."',
        choices: [
          { tag: 'wise',       label: '🙇 Peço perdão em nome dos humanos' },
          { tag: 'aggressive', label: '💢 Exijo que ela controle os espíritos' },
          { tag: 'fearful',    label: '😨 Pergunto como posso ajudar' },
        ],
      },
      {
        title: 'O Ritual',
        text: 'Para curar a Mãe Espírito, você precisa coletar 4 essências elementais — uma de cada nação.',
        choices: [
          { tag: 'aggressive', label: '⚡ Vou rápido, lutando se preciso' },
          { tag: 'wise',       label: '🤝 Negocio em cada nação' },
          { tag: 'fearful',    label: '🤲 Peço aliados em cada nação' },
        ],
      },
      {
        type: 'battle',
        title: 'Espírito da Discórdia',
        text: 'Um espírito ancestral, alimentado pelo conflito humano, materializa-se diante de você.\n\n⚖️ JULGAMENTO ESPIRITUAL!',
        opponent: {
          name: 'Espírito da Discórdia',
          element: 'Neutro',
          icon: '⚖️',
          level: 35,
          attack: 100,
          defense: 70,
          maxHp: 400,
          maxChi: 180,
        },
        rewardOnWin: { exp: 1500, yuan: 700 },
        rewardOnLose: { exp: 280, yuan: 100 },
      },
      {
        title: 'O Selamento',
        text: 'Você devolve as essências. A Mãe Espírito agradece, mas alerta: o equilíbrio depende de TODOS os humanos, não só do Avatar.',
        choices: [
          { tag: 'wise',       label: '📚 Vou ensinar isso ao mundo' },
          { tag: 'aggressive', label: '⚔️ Imporei o equilíbrio se preciso' },
          { tag: 'fearful',    label: '😔 Carrego o peso sozinho' },
        ],
      },
      {
        title: 'O Retorno',
        text: 'De volta ao mundo físico, você sente uma conexão profunda com os espíritos.',
        choices: [
          { tag: 'wise',       label: '☯️ Vou viver entre os dois mundos' },
          { tag: 'aggressive', label: '⚡ Uso esse poder para restaurar a ordem' },
          { tag: 'fearful',    label: '🙏 Recolho-me em meditação' },
        ],
      },
    ],
  },

  // CAPÍTULO 10 — A Origem do Universo (final!)
  10: {
    title: 'A Origem do Universo',
    description: 'O confronto final. O que era para ser o fim — pode ser o começo.',
    scenes: [
      {
        title: 'O Chamado Final',
        text: 'Uma voz primordial ecoa em sua mente: "Apenas um Avatar pleno pode resolver isto. Venha à origem."',
        choices: [
          { tag: 'wise',       label: '🧘 Aceito a chamada com serenidade' },
          { tag: 'aggressive', label: '⚡ Vou pronto para o combate final' },
          { tag: 'fearful',    label: '😨 Vou, mesmo sem entender' },
        ],
      },
      {
        title: 'O Caminho Estelar',
        text: 'Você atravessa a fronteira da realidade. Estrelas se movem ao seu redor.',
        choices: [
          { tag: 'wise',       label: '✨ Sigo a luz mais pura' },
          { tag: 'aggressive', label: '🔥 Forço caminho com poder' },
          { tag: 'fearful',    label: '🤲 Deixo o destino me guiar' },
        ],
      },
      {
        title: 'O Antigo',
        text: 'Você encontra o PRIMEIRO Avatar. Ele já foi humano há eras incontáveis.\n\n— "Você é o último. O ciclo precisa fechar."',
        choices: [
          { tag: 'wise',       label: '☯️ Aceito ser parte do ciclo' },
          { tag: 'aggressive', label: '💪 Recuso — vou criar um novo ciclo' },
          { tag: 'fearful',    label: '😢 Imploro por outro caminho' },
        ],
      },
      {
        type: 'battle',
        title: 'O Primeiro Avatar',
        text: 'Para fechar o ciclo, você precisa derrotar (ou ser derrotado por) o Primeiro. Esta é a batalha definitiva.\n\n🌌 TODA A REALIDADE OBSERVA!',
        opponent: {
          name: 'O Primeiro Avatar',
          element: 'Neutro',
          icon: '🌌',
          level: 45,
          attack: 130,
          defense: 100,
          maxHp: 600,
          maxChi: 250,
        },
        rewardOnWin: { exp: 3000, yuan: 1500 },
        rewardOnLose: { exp: 500, yuan: 200 },
      },
      {
        title: 'O Eco',
        text: 'A batalha termina. Você vê o universo inteiro através dos olhos do Antigo.',
        choices: [
          { tag: 'wise',       label: '🌟 Compreendo o equilíbrio supremo' },
          { tag: 'aggressive', label: '⚔️ Sinto o poder de toda a história em mim' },
          { tag: 'fearful',    label: '🙏 Sinto humildade ante o todo' },
        ],
      },
      {
        title: 'A Escolha Final',
        text: 'O Antigo oferece: "Você pode ascender — virar uma estrela eterna. Ou voltar — viver mais 50 anos como mortal."',
        choices: [
          { tag: 'wise',       label: '🌍 Volto — meu povo precisa de mim' },
          { tag: 'aggressive', label: '🌟 Ascendo — vou iluminar tudo do alto' },
          { tag: 'fearful',    label: '🤔 Volto — não estou pronto p/ ser eterno' },
        ],
      },
      {
        title: 'O Legado',
        text: 'Sua decisão ressoa por gerações. O nome do Avatar de seu tempo será lembrado para sempre.',
        choices: [
          { tag: 'wise',       label: '☯️ Que minha lição seja "equilíbrio em tudo"' },
          { tag: 'aggressive', label: '⚔️ Que se lembrem da minha força e coragem' },
          { tag: 'fearful',    label: '🙏 Que se lembrem da minha humildade' },
        ],
      },
    ],
  },
};

export default STORY;
