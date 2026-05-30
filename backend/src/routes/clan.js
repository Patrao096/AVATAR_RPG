// backend/src/routes/clan.js
// Endpoints:
//
//  Listagem & ingresso público
//   GET  /api/clan/mine                   — meu clã (com membros, perms)
//   GET  /api/clan/:id                    — detalhes públicos de um clã
//
//  Criação & gestão
//   POST   /api/clan/create               — criar (preço base 500 Yuan)
//   POST   /api/clan/join                 — entrar (público) ou pedir entrada (privado)
//   POST   /api/clan/leave                — sair
//   PATCH  /api/clan/settings             — owner: editar nome/desc/visibility/banner/motto
//   POST   /api/clan/expand               — owner: expandir capacidade
//   DELETE /api/clan                      — owner: excluir clã
//
//  Moderação (owner/officer)
//   POST   /api/clan/kick/:userId         — remover membro
//   POST   /api/clan/ban/:userId          — banir
//   POST   /api/clan/unban/:userId        — desbanir
//   POST   /api/clan/promote/:userId      — virar officer
//   POST   /api/clan/demote/:userId       — voltar a member
//
//  Convites
//   POST   /api/clan/invite/:userId       — convidar usuário
//   GET    /api/clan/invites              — meus convites pendentes
//   POST   /api/clan/invite/:id/accept
//   POST   /api/clan/invite/:id/reject
//
//  Pedidos de entrada (clã privado)
//   GET    /api/clan/requests             — owner/officer: ver pedidos
//   POST   /api/clan/request/:id/approve
//   POST   /api/clan/request/:id/reject
//
//  Baú do tesouro
//   POST   /api/clan/treasury/deposit     — qualquer membro deposita
//   POST   /api/clan/treasury/withdraw    — owner: saca p/ usar (compra capacidade etc.)
//
//  Chat (polling)
//   GET    /api/clan/messages?since=...   — busca mensagens (com cursor)
//   POST   /api/clan/messages             — enviar mensagem

import express from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';
import { hasPremium } from '../lib/subscription-helper.js';

const router = express.Router();

// ─── Configurações ───
//   • Lvl 50+: GRATUITO (não exige Premium nem custo)
//   • Lvl < 50: paga 150 000 Yuan
const CLAN_FREE_LEVEL_THRESHOLD = 50;
const CLAN_CREATION_COST_BELOW = 150000;
const CAPACITY_TIERS = [
  { max: 10,  cost: 0,      label: 'Padrão' },
  { max: 15,  cost: 5000,   label: 'Expandido I' },
  { max: 20,  cost: 15000,  label: 'Expandido II' },
  { max: 30,  cost: 50000,  label: 'Grande' },
  { max: 50,  cost: 200000, label: 'Lendário (max)' },
];
const INVITE_EXPIRY_HOURS = 48;
const MAX_MESSAGES_PER_BATCH = 50;
const MESSAGE_RATE_LIMIT_MS = 2000;       // 2s entre mensagens por user

// Cache de últimas mensagens por usuário (anti-flood simples)
const lastMessageAt = new Map();

// ─── Helpers ───
function isOwner(member) { return member?.role === 'owner'; }
function isOfficer(member) { return member?.role === 'owner' || member?.role === 'officer'; }

async function getMyMembership(userId) {
  return prisma.clanMember.findUnique({
    where: { userId },
    include: { clan: true },
  });
}

async function loadFullClan(clanId) {
  return prisma.clan.findUnique({
    where: { id: clanId },
    include: {
      members: {
        include: { user: { include: { character: true } } },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });
}

// LISTAGEM PÚBLICA
router.get('/', async (req, res) => {
  try {
    const clans = await prisma.clan.findMany({
      include: { members: true },
      orderBy: [{ level: 'desc' }, { wins: 'desc' }],
    });
    res.json(clans.map(c => ({
      id: c.id,
      name: c.name,
      element: c.element,
      description: c.description,
      motto: c.motto,
      level: c.level,
      wins: c.wins,
      visibility: c.visibility,
      maxMembers: c.maxMembers,
      memberCount: c.members.length,
      bannerColor: c.bannerColor,
      isFull: c.members.length >= c.maxMembers,
      championBadges: Array.isArray(c.championBadges) ? c.championBadges.length : 0,
    })));
  } catch (error) {
    console.error('clan GET /:', error);
    res.status(500).json({ error: 'Erro ao listar clãs' });
  }
});

// MEU CLÃ (visão completa do membro)
//   ⚠️ DEVE vir ANTES de GET /:id senão o Express
//   trata "mine" como :id → 404.
router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const member = await getMyMembership(req.userId);
    // para o frontend exibir no modal "Criar Clã" (lvl/yuan).
    const myCharacter = await prisma.character.findUnique({ where: { userId: req.userId } });
    const myCharSummary = myCharacter ? {
      level: myCharacter.level,
      element: myCharacter.element,
      money: myCharacter.money,
    } : null;

    if (!member) {
      return res.json({
        inClan: false,
        myCharacter: myCharSummary,
        clanCreation: {
          freeLevelThreshold: CLAN_FREE_LEVEL_THRESHOLD,
          costBelowThreshold: CLAN_CREATION_COST_BELOW,
          isFreeForMe: !!myCharacter && myCharacter.level >= CLAN_FREE_LEVEL_THRESHOLD,
        },
      });
    }

    const fullClan = await loadFullClan(member.clanId);

    res.json({
      inClan: true,
      myRole: member.role,
      myContribution: member.contributedYuan,
      myCharacter: myCharSummary,
      clan: {
        id: fullClan.id,
        name: fullClan.name,
        element: fullClan.element,
        description: fullClan.description,
        motto: fullClan.motto,
        level: fullClan.level,
        exp: fullClan.exp,
        wins: fullClan.wins,
        treasury: fullClan.treasury,
        visibility: fullClan.visibility,
        maxMembers: fullClan.maxMembers,
        bannerColor: fullClan.bannerColor,
        championBadges: Array.isArray(fullClan.championBadges) ? fullClan.championBadges : [],
        activeBuff: (fullClan.buffType && fullClan.buffExpiresAt && new Date(fullClan.buffExpiresAt) > new Date())
          ? { type: fullClan.buffType, value: fullClan.buffValue, expiresAt: fullClan.buffExpiresAt }
          : null,
        memberCount: fullClan.members.length,
        members: fullClan.members.map(m => ({
          userId: m.userId,
          username: m.user.username,
          avatar: m.user.avatar,
          role: m.role,
          joinedAt: m.joinedAt,
          level: m.user.character?.level || 1,
          element: m.user.character?.element || null,
          contributedYuan: m.contributedYuan,
        })),
      },
      capacityTiers: CAPACITY_TIERS,
    });
  } catch (error) {
    console.error('clan/mine:', error);
    res.status(500).json({ error: 'Erro ao buscar clã' });
  }
});

// CRIAR CLÃ
router.post('/create', authMiddleware, async (req, res) => {
  const { name, element, description, motto, visibility = 'public', bannerColor } = req.body;

  if (!name || !element) return res.status(400).json({ error: 'Nome e elemento obrigatórios' });
  if (name.length < 3 || name.length > 24) return res.status(400).json({ error: 'Nome: 3-24 caracteres' });
  if (!['Fogo', 'Água', 'Terra', 'Ar'].includes(element)) {
    return res.status(400).json({ error: 'Elemento inválido' });
  }
  if (!['public', 'private'].includes(visibility)) {
    return res.status(400).json({ error: 'Visibilidade deve ser public ou private' });
  }

  try {
    // Regra: lvl 50+ é grátis; abaixo paga 150k Yuan.
    const existing = await getMyMembership(req.userId);
    if (existing) return res.status(400).json({ error: 'Você já está em um clã' });

    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (!character) return res.status(404).json({ error: 'Personagem não encontrado' });
    if (character.element !== element) {
      return res.status(400).json({ error: `Você precisa ser do elemento ${element} para criar este clã` });
    }

    const isFreeByLevel = character.level >= CLAN_FREE_LEVEL_THRESHOLD;
    const cost = isFreeByLevel ? 0 : CLAN_CREATION_COST_BELOW;
    if (!isFreeByLevel && character.money < cost) {
      return res.status(400).json({
        error: `Para criar um clã antes do nível ${CLAN_FREE_LEVEL_THRESHOLD} você precisa de ${cost.toLocaleString('pt-BR')} Yuan (você tem ${character.money.toLocaleString('pt-BR')}).`,
        requiredLevel: CLAN_FREE_LEVEL_THRESHOLD,
        requiredYuan: cost,
      });
    }

    const dup = await prisma.clan.findUnique({ where: { name } });
    if (dup) return res.status(400).json({ error: 'Já existe um clã com esse nome' });

    const clan = await prisma.$transaction(async (tx) => {
      const c = await tx.clan.create({
        data: {
          name,
          element,
          description: description || null,
          motto: motto || null,
          visibility,
          bannerColor: bannerColor || null,
          maxMembers: 10,
        },
      });
      await tx.clanMember.create({
        data: { clanId: c.id, userId: req.userId, role: 'owner' },
      });
      if (cost > 0) {
        await tx.character.update({
          where: { id: character.id },
          data: { money: { decrement: cost } },
        });
      }
      return c;
    });

    res.json({
      success: true,
      clan,
      message: isFreeByLevel
        ? `🏛️ Clã "${name}" criado (grátis · lvl ${character.level})!`
        : `🏛️ Clã "${name}" criado por ${cost.toLocaleString('pt-BR')} Yuan!`,
    });
  } catch (error) {
    console.error('clan/create:', error);
    res.status(500).json({ error: 'Erro ao criar clã' });
  }
});

// ENTRAR (público) ou PEDIR ENTRADA (privado)
router.post('/join', authMiddleware, async (req, res) => {
  const { clanId, message } = req.body;
  if (!clanId) return res.status(400).json({ error: 'clanId obrigatório' });

  try {
    const existing = await getMyMembership(req.userId);
    if (existing) return res.status(400).json({ error: 'Você já está em um clã' });

    const clan = await prisma.clan.findUnique({
      where: { id: clanId },
      include: { members: true },
    });
    if (!clan) return res.status(404).json({ error: 'Clã não encontrado' });

    // Banido?
    const ban = await prisma.clanBan.findUnique({
      where: { clanId_userId: { clanId, userId: req.userId } },
    });
    if (ban) return res.status(403).json({ error: 'Você foi banido deste clã' });

    if (clan.members.length >= clan.maxMembers) {
      return res.status(400).json({ error: 'Clã está lotado' });
    }

    if (clan.visibility === 'private') {
      // Cria pedido (idempotente)
      try {
        await prisma.clanJoinRequest.upsert({
          where: { clanId_userId: { clanId, userId: req.userId } },
          create: {
            clanId,
            userId: req.userId,
            message: message?.slice(0, 200) || null,
            status: 'pending',
          },
          update: { status: 'pending', message: message?.slice(0, 200) || null },
        });
      } catch (e) {
        return res.status(500).json({ error: 'Erro ao criar pedido' });
      }
      return res.json({ success: true, requested: true, message: 'Pedido enviado. Aguarde aprovação.' });
    }

    // Público: entra direto
    await prisma.clanMember.create({
      data: { clanId, userId: req.userId, role: 'member' },
    });
    res.json({ success: true, joined: true, message: `🏛️ Entrou no clã "${clan.name}"!` });
  } catch (error) {
    console.error('clan/join:', error);
    res.status(500).json({ error: 'Erro ao entrar no clã' });
  }
});

// SAIR DO CLÃ
router.post('/leave', authMiddleware, async (req, res) => {
  try {
    const member = await getMyMembership(req.userId);
    if (!member) return res.status(400).json({ error: 'Você não está em um clã' });

    if (member.role === 'owner') {
      // Owner só pode sair se for o único membro OU transferir antes
      const count = await prisma.clanMember.count({ where: { clanId: member.clanId } });
      if (count > 1) {
        return res.status(400).json({
          error: 'Você é o dono. Promova alguém a owner antes de sair, ou exclua o clã.',
        });
      }
      // Único: deleta o clã junto
      await prisma.clan.delete({ where: { id: member.clanId } });
      return res.json({ success: true, message: 'Você saiu e o clã foi deletado (era o único membro).' });
    }

    await prisma.clanMember.delete({ where: { id: member.id } });
    res.json({ success: true, message: 'Você saiu do clã' });
  } catch (error) {
    console.error('clan/leave:', error);
    res.status(500).json({ error: 'Erro ao sair do clã' });
  }
});

// EDITAR CONFIGURAÇÕES (owner)
router.patch('/settings', authMiddleware, async (req, res) => {
  try {
    const member = await getMyMembership(req.userId);
    if (!member || !isOwner(member)) {
      return res.status(403).json({ error: 'Apenas o dono pode editar' });
    }

    const data = {};
    if (req.body.description !== undefined) data.description = req.body.description?.slice(0, 200) || null;
    if (req.body.motto !== undefined) data.motto = req.body.motto?.slice(0, 60) || null;
    if (req.body.visibility !== undefined) {
      if (!['public', 'private'].includes(req.body.visibility)) {
        return res.status(400).json({ error: 'Visibilidade inválida' });
      }
      data.visibility = req.body.visibility;
    }
    if (req.body.bannerColor !== undefined) {
      const c = req.body.bannerColor;
      if (c && !/^#[0-9A-Fa-f]{6}$/.test(c)) return res.status(400).json({ error: 'Cor inválida (#RRGGBB)' });
      data.bannerColor = c || null;
    }

    const updated = await prisma.clan.update({
      where: { id: member.clanId },
      data,
    });
    res.json({ success: true, clan: updated });
  } catch (error) {
    console.error('clan/settings:', error);
    res.status(500).json({ error: 'Erro ao atualizar' });
  }
});

// EXPANDIR CAPACIDADE (owner) — paga do baú
router.post('/expand', authMiddleware, async (req, res) => {
  const { tierIndex } = req.body;
  if (typeof tierIndex !== 'number') return res.status(400).json({ error: 'tierIndex obrigatório' });

  try {
    const member = await getMyMembership(req.userId);
    if (!member || !isOwner(member)) return res.status(403).json({ error: 'Apenas o dono' });

    const tier = CAPACITY_TIERS[tierIndex];
    if (!tier) return res.status(400).json({ error: 'Tier inválido' });

    const clan = await prisma.clan.findUnique({ where: { id: member.clanId } });
    if (clan.maxMembers >= tier.max) {
      return res.status(400).json({ error: 'Você já está neste tier ou superior' });
    }
    if (clan.treasury < tier.cost) {
      return res.status(400).json({ error: `Baú precisa de ${tier.cost} Yuan` });
    }

    const updated = await prisma.clan.update({
      where: { id: member.clanId },
      data: {
        maxMembers: tier.max,
        treasury: { decrement: tier.cost },
      },
    });
    res.json({ success: true, clan: updated, message: `Capacidade expandida para ${tier.max}!` });
  } catch (error) {
    console.error('clan/expand:', error);
    res.status(500).json({ error: 'Erro ao expandir' });
  }
});

// EXCLUIR CLÃ (owner)
router.delete('/', authMiddleware, async (req, res) => {
  try {
    const member = await getMyMembership(req.userId);
    if (!member || !isOwner(member)) return res.status(403).json({ error: 'Apenas o dono' });

    await prisma.clan.delete({ where: { id: member.clanId } });
    res.json({ success: true, message: 'Clã excluído' });
  } catch (error) {
    console.error('clan DELETE /:', error);
    res.status(500).json({ error: 'Erro ao excluir' });
  }
});

// MODERAÇÃO — KICK
router.post('/kick/:userId', authMiddleware, async (req, res) => {
  try {
    const me = await getMyMembership(req.userId);
    if (!me || !isOfficer(me)) return res.status(403).json({ error: 'Apenas owner/officer' });

    const target = await prisma.clanMember.findFirst({
      where: { userId: req.params.userId, clanId: me.clanId },
    });
    if (!target) return res.status(404).json({ error: 'Membro não encontrado' });
    if (target.userId === req.userId) return res.status(400).json({ error: 'Você não pode se kickar' });
    if (isOwner(target)) return res.status(400).json({ error: 'Não pode kickar o owner' });
    // Officer não pode kickar outro officer
    if (target.role === 'officer' && me.role !== 'owner') {
      return res.status(403).json({ error: 'Officer só pode kickar members' });
    }

    await prisma.clanMember.delete({ where: { id: target.id } });
    res.json({ success: true, message: 'Membro removido' });
  } catch (error) {
    console.error('clan/kick:', error);
    res.status(500).json({ error: 'Erro' });
  }
});

// MODERAÇÃO — BAN
router.post('/ban/:userId', authMiddleware, async (req, res) => {
  const { reason } = req.body;
  try {
    const me = await getMyMembership(req.userId);
    if (!me || !isOwner(me)) return res.status(403).json({ error: 'Apenas owner pode banir' });

    if (req.params.userId === req.userId) return res.status(400).json({ error: 'Não pode se banir' });

    await prisma.$transaction(async (tx) => {
      // Remove se for membro
      const target = await tx.clanMember.findFirst({
        where: { userId: req.params.userId, clanId: me.clanId },
      });
      if (target) await tx.clanMember.delete({ where: { id: target.id } });

      // Cria ban (idempotente)
      await tx.clanBan.upsert({
        where: { clanId_userId: { clanId: me.clanId, userId: req.params.userId } },
        create: {
          clanId: me.clanId,
          userId: req.params.userId,
          bannedBy: req.userId,
          reason: reason?.slice(0, 200) || null,
        },
        update: { bannedBy: req.userId, reason: reason?.slice(0, 200) || null },
      });
    });

    res.json({ success: true, message: 'Usuário banido' });
  } catch (error) {
    console.error('clan/ban:', error);
    res.status(500).json({ error: 'Erro' });
  }
});

router.post('/unban/:userId', authMiddleware, async (req, res) => {
  try {
    const me = await getMyMembership(req.userId);
    if (!me || !isOwner(me)) return res.status(403).json({ error: 'Apenas owner' });

    await prisma.clanBan.deleteMany({
      where: { clanId: me.clanId, userId: req.params.userId },
    });
    res.json({ success: true, message: 'Banimento removido' });
  } catch (error) {
    res.status(500).json({ error: 'Erro' });
  }
});

router.post('/promote/:userId', authMiddleware, async (req, res) => {
  try {
    const me = await getMyMembership(req.userId);
    if (!me || !isOwner(me)) return res.status(403).json({ error: 'Apenas owner' });

    const target = await prisma.clanMember.findFirst({
      where: { userId: req.params.userId, clanId: me.clanId },
    });
    if (!target) return res.status(404).json({ error: 'Membro não encontrado' });
    if (target.role === 'owner') return res.status(400).json({ error: 'Já é owner' });

    await prisma.clanMember.update({ where: { id: target.id }, data: { role: 'officer' } });
    res.json({ success: true, message: 'Promovido a officer' });
  } catch (error) {
    res.status(500).json({ error: 'Erro' });
  }
});

router.post('/demote/:userId', authMiddleware, async (req, res) => {
  try {
    const me = await getMyMembership(req.userId);
    if (!me || !isOwner(me)) return res.status(403).json({ error: 'Apenas owner' });

    const target = await prisma.clanMember.findFirst({
      where: { userId: req.params.userId, clanId: me.clanId },
    });
    if (!target) return res.status(404).json({ error: 'Membro não encontrado' });
    if (target.role !== 'officer') return res.status(400).json({ error: 'Não é officer' });

    await prisma.clanMember.update({ where: { id: target.id }, data: { role: 'member' } });
    res.json({ success: true, message: 'Rebaixado a membro' });
  } catch (error) {
    res.status(500).json({ error: 'Erro' });
  }
});

// CONVITES
router.post('/invite/:userId', authMiddleware, async (req, res) => {
  try {
    const me = await getMyMembership(req.userId);
    if (!me || !isOfficer(me)) return res.status(403).json({ error: 'Apenas owner/officer pode convidar' });

    if (req.params.userId === req.userId) return res.status(400).json({ error: 'Você já está no clã' });

    // Verifica se o usuário existe
    const targetUser = await prisma.user.findUnique({ where: { id: req.params.userId } });
    if (!targetUser) return res.status(404).json({ error: 'Usuário não encontrado' });

    // Já é de algum clã?
    const targetMember = await prisma.clanMember.findUnique({ where: { userId: req.params.userId } });
    if (targetMember) return res.status(400).json({ error: 'Usuário já está em um clã' });

    // Banido?
    const ban = await prisma.clanBan.findUnique({
      where: { clanId_userId: { clanId: me.clanId, userId: req.params.userId } },
    });
    if (ban) return res.status(400).json({ error: 'Usuário está banido do clã' });

    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);

    await prisma.clanInvite.upsert({
      where: { clanId_invitedUserId: { clanId: me.clanId, invitedUserId: req.params.userId } },
      create: {
        clanId: me.clanId,
        invitedUserId: req.params.userId,
        invitedBy: req.userId,
        expiresAt,
      },
      update: {
        invitedBy: req.userId,
        status: 'pending',
        expiresAt,
      },
    });

    res.json({ success: true, message: `Convite enviado para ${targetUser.username}` });
  } catch (error) {
    console.error('clan/invite:', error);
    res.status(500).json({ error: 'Erro ao convidar' });
  }
});

// Buscar usuário pelo Discord ID ou username (para o "convidar")
router.get('/search-user', authMiddleware, async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);
  try {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { discordId: q },
          { username: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { character: true, clanMember: true },
      take: 8,
    });
    res.json(users.map(u => ({
      id: u.id,
      username: u.username,
      discordId: u.discordId,
      avatar: u.avatar,
      level: u.character?.level || 1,
      element: u.character?.element || null,
      inClan: !!u.clanMember,
    })));
  } catch (error) {
    res.status(500).json({ error: 'Erro' });
  }
});

router.get('/invites', authMiddleware, async (req, res) => {
  try {
    const invites = await prisma.clanInvite.findMany({
      where: {
        invitedUserId: req.userId,
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
      include: { clan: { include: { members: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(invites.map(i => ({
      id: i.id,
      clan: {
        id: i.clan.id,
        name: i.clan.name,
        element: i.clan.element,
        memberCount: i.clan.members.length,
        maxMembers: i.clan.maxMembers,
        bannerColor: i.clan.bannerColor,
      },
      expiresAt: i.expiresAt,
      createdAt: i.createdAt,
    })));
  } catch (error) {
    res.status(500).json({ error: 'Erro' });
  }
});

router.post('/invite/:id/accept', authMiddleware, async (req, res) => {
  try {
    const invite = await prisma.clanInvite.findUnique({
      where: { id: req.params.id },
      include: { clan: { include: { members: true } } },
    });
    if (!invite) return res.status(404).json({ error: 'Convite não encontrado' });
    if (invite.invitedUserId !== req.userId) return res.status(403).json({ error: 'Não é seu convite' });
    if (invite.status !== 'pending') return res.status(400).json({ error: 'Convite já respondido' });
    if (invite.expiresAt < new Date()) {
      await prisma.clanInvite.update({ where: { id: invite.id }, data: { status: 'expired' } });
      return res.status(400).json({ error: 'Convite expirado' });
    }

    const myMembership = await getMyMembership(req.userId);
    if (myMembership) return res.status(400).json({ error: 'Você já está em um clã' });

    if (invite.clan.members.length >= invite.clan.maxMembers) {
      return res.status(400).json({ error: 'Clã está lotado' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.clanMember.create({
        data: { clanId: invite.clanId, userId: req.userId, role: 'member' },
      });
      await tx.clanInvite.update({ where: { id: invite.id }, data: { status: 'accepted' } });
    });

    res.json({ success: true, message: `Você entrou no clã "${invite.clan.name}"!` });
  } catch (error) {
    console.error('clan/invite/accept:', error);
    res.status(500).json({ error: 'Erro' });
  }
});

router.post('/invite/:id/reject', authMiddleware, async (req, res) => {
  try {
    const invite = await prisma.clanInvite.findUnique({ where: { id: req.params.id } });
    if (!invite || invite.invitedUserId !== req.userId) {
      return res.status(404).json({ error: 'Convite não encontrado' });
    }
    await prisma.clanInvite.update({ where: { id: invite.id }, data: { status: 'rejected' } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro' });
  }
});

// PEDIDOS DE ENTRADA (clã privado)
router.get('/requests', authMiddleware, async (req, res) => {
  try {
    const me = await getMyMembership(req.userId);
    if (!me || !isOfficer(me)) return res.status(403).json({ error: 'Apenas officer/owner' });

    const requests = await prisma.clanJoinRequest.findMany({
      where: { clanId: me.clanId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
    // Hidrata com dados do usuário
    const userIds = requests.map(r => r.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      include: { character: true },
    });
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    res.json(requests.map(r => {
      const u = userMap[r.userId];
      return {
        id: r.id,
        userId: r.userId,
        username: u?.username || '?',
        avatar: u?.avatar,
        level: u?.character?.level || 1,
        element: u?.character?.element || null,
        message: r.message,
        createdAt: r.createdAt,
      };
    }));
  } catch (error) {
    console.error('clan/requests:', error);
    res.status(500).json({ error: 'Erro' });
  }
});

router.post('/request/:id/approve', authMiddleware, async (req, res) => {
  try {
    const me = await getMyMembership(req.userId);
    if (!me || !isOfficer(me)) return res.status(403).json({ error: 'Apenas officer/owner' });

    const request = await prisma.clanJoinRequest.findUnique({ where: { id: req.params.id } });
    if (!request || request.clanId !== me.clanId) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }
    if (request.status !== 'pending') return res.status(400).json({ error: 'Pedido já respondido' });

    const clan = await prisma.clan.findUnique({
      where: { id: me.clanId },
      include: { members: true },
    });
    if (clan.members.length >= clan.maxMembers) return res.status(400).json({ error: 'Clã lotado' });

    // Já está em outro clã?
    const otherMembership = await prisma.clanMember.findUnique({ where: { userId: request.userId } });
    if (otherMembership) {
      await prisma.clanJoinRequest.update({ where: { id: request.id }, data: { status: 'rejected' } });
      return res.status(400).json({ error: 'Usuário já está em outro clã' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.clanMember.create({
        data: { clanId: me.clanId, userId: request.userId, role: 'member' },
      });
      await tx.clanJoinRequest.update({ where: { id: request.id }, data: { status: 'approved' } });
    });

    res.json({ success: true, message: 'Pedido aprovado!' });
  } catch (error) {
    console.error('clan/request/approve:', error);
    res.status(500).json({ error: 'Erro' });
  }
});

router.post('/request/:id/reject', authMiddleware, async (req, res) => {
  try {
    const me = await getMyMembership(req.userId);
    if (!me || !isOfficer(me)) return res.status(403).json({ error: 'Apenas officer/owner' });

    const request = await prisma.clanJoinRequest.findUnique({ where: { id: req.params.id } });
    if (!request || request.clanId !== me.clanId) return res.status(404).json({ error: 'Não encontrado' });

    await prisma.clanJoinRequest.update({ where: { id: request.id }, data: { status: 'rejected' } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro' });
  }
});

// BAÚ DO TESOURO
router.post('/treasury/deposit', authMiddleware, async (req, res) => {
  const amount = parseInt(req.body.amount);
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Valor inválido' });

  try {
    const member = await getMyMembership(req.userId);
    if (!member) return res.status(400).json({ error: 'Você não está em um clã' });

    const character = await prisma.character.findUnique({ where: { userId: req.userId } });
    if (character.money < amount) return res.status(400).json({ error: 'Yuan insuficiente' });

    await prisma.$transaction([
      prisma.character.update({
        where: { id: character.id },
        data: { money: { decrement: amount } },
      }),
      prisma.clan.update({
        where: { id: member.clanId },
        data: { treasury: { increment: amount } },
      }),
      prisma.clanMember.update({
        where: { id: member.id },
        data: { contributedYuan: { increment: amount } },
      }),
    ]);

    res.json({ success: true, message: `Depositou ${amount} Yuan no baú` });
  } catch (error) {
    console.error('clan/treasury/deposit:', error);
    res.status(500).json({ error: 'Erro' });
  }
});

router.post('/treasury/withdraw', authMiddleware, async (req, res) => {
  const amount = parseInt(req.body.amount);
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Valor inválido' });

  try {
    const member = await getMyMembership(req.userId);
    if (!member || !isOwner(member)) return res.status(403).json({ error: 'Apenas owner pode sacar' });

    const clan = await prisma.clan.findUnique({ where: { id: member.clanId } });
    if (clan.treasury < amount) return res.status(400).json({ error: 'Baú não tem Yuan suficiente' });

    await prisma.$transaction([
      prisma.clan.update({
        where: { id: member.clanId },
        data: { treasury: { decrement: amount } },
      }),
      prisma.character.update({
        where: { userId: req.userId },
        data: { money: { increment: amount } },
      }),
    ]);

    res.json({ success: true, message: `Sacou ${amount} Yuan` });
  } catch (error) {
    res.status(500).json({ error: 'Erro' });
  }
});

// CHAT (polling)
router.get('/messages', authMiddleware, async (req, res) => {
  try {
    const member = await getMyMembership(req.userId);
    if (!member) return res.status(403).json({ error: 'Você não está em um clã' });

    const since = req.query.since ? new Date(req.query.since) : null;
    const messages = await prisma.clanMessage.findMany({
      where: {
        clanId: member.clanId,
        ...(since ? { createdAt: { gt: since } } : {}),
      },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
      take: MAX_MESSAGES_PER_BATCH,
    });

    res.json(messages.map(m => ({
      id: m.id,
      userId: m.userId,
      username: m.user.username,
      avatar: m.user.avatar,
      content: m.content,
      createdAt: m.createdAt,
      isMine: m.userId === req.userId,
    })));
  } catch (error) {
    console.error('clan/messages GET:', error);
    res.status(500).json({ error: 'Erro' });
  }
});

router.post('/messages', authMiddleware, async (req, res) => {
  const content = (req.body.content || '').trim();
  if (!content) return res.status(400).json({ error: 'Mensagem vazia' });
  if (content.length > 500) return res.status(400).json({ error: 'Máximo 500 caracteres' });

  // Rate limit
  const last = lastMessageAt.get(req.userId) || 0;
  if (Date.now() - last < MESSAGE_RATE_LIMIT_MS) {
    return res.status(429).json({ error: 'Aguarde antes de enviar outra mensagem' });
  }

  try {
    const member = await getMyMembership(req.userId);
    if (!member) return res.status(403).json({ error: 'Você não está em um clã' });

    const msg = await prisma.clanMessage.create({
      data: { clanId: member.clanId, userId: req.userId, content },
      include: { user: true },
    });
    lastMessageAt.set(req.userId, Date.now());

    res.json({
      id: msg.id,
      userId: msg.userId,
      username: msg.user.username,
      avatar: msg.user.avatar,
      content: msg.content,
      createdAt: msg.createdAt,
      isMine: true,
    });
  } catch (error) {
    console.error('clan/messages POST:', error);
    res.status(500).json({ error: 'Erro' });
  }
});

router.get('/war/active', async (req, res) => {
  try {
    const { getActiveEvent, getLeaderboard } = await import('../lib/clan-war.js');
    const event = await getActiveEvent();
    if (!event) return res.json({ active: false });
    res.json({
      active: true,
      event: {
        id: event.id,
        name: event.name,
        description: event.description,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        status: event.status,
      },
      leaderboard: getLeaderboard(event),
    });
  } catch (error) {
    console.error('clan/war/active:', error);
    res.status(500).json({ error: 'Erro ao buscar evento' });
  }
});

// Histórico de eventos finalizados (com clãs campeões)
router.get('/war/history', async (req, res) => {
  try {
    const events = await prisma.clanWarEvent.findMany({
      where: { status: 'finished' },
      orderBy: { endsAt: 'desc' },
      take: 10,
      select: {
        id: true, name: true, description: true,
        startsAt: true, endsAt: true, scoreboard: true,
      },
    });
    const compact = events.map(e => ({
      id: e.id,
      name: e.name,
      endsAt: e.endsAt,
      championClanId: e.scoreboard?.championClanId || null,
      championClanName: e.scoreboard?.championClanName || null,
    }));
    res.json(compact);
  } catch (error) {
    console.error('clan/war/history:', error);
    res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
});

// DETALHES DE UM CLÃ (genérico — DEVE ser a ÚLTIMA rota GET
// porque /:id captura qualquer string e bloquearia
// rotas estáticas como /mine, /invites, /requests, /search-user...)
router.get('/:id', async (req, res) => {
  try {
    const c = await prisma.clan.findUnique({
      where: { id: req.params.id },
      include: {
        members: {
          include: { user: { include: { character: true } } },
        },
      },
    });
    if (!c) return res.status(404).json({ error: 'Clã não encontrado' });

    res.json({
      id: c.id,
      name: c.name,
      element: c.element,
      description: c.description,
      motto: c.motto,
      level: c.level,
      wins: c.wins,
      visibility: c.visibility,
      maxMembers: c.maxMembers,
      memberCount: c.members.length,
      bannerColor: c.bannerColor,
      members: c.members.map(m => ({
        id: m.id,
        userId: m.userId,
        username: m.user.username,
        avatar: m.user.avatar,
        role: m.role,
        joinedAt: m.joinedAt,
        level: m.user.character?.level || 1,
        element: m.user.character?.element || null,
      })),
    });
  } catch (error) {
    console.error('clan GET /:id', error);
    res.status(500).json({ error: 'Erro ao buscar clã' });
  }
});

export default router;
