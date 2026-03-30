const fs = require("fs-extra");
const path = require("path");

let fonts;
try {
  fonts = require("../../func/font.js");
} catch (error) {}

const CONFIG = {
  MAX_TURNS: 100,
  BASE_REWARD: 1000,
  RATE_MULTIPLIER: 1.2,
  DEFAULT_PETS: [
    { key: "phil", name: "PhilCassidy", icon: "🔫", atk: 45, def: 35, magic: 20, hp: 120 },
    { key: "liane", name: "Liane", icon: "🎀", atk: 30, def: 25, magic: 50, hp: 100 },
    { key: "highroll", name: "HighRollPass", icon: "🃏", atk: 55, def: 20, magic: 30, hp: 110 },
    { key: "shadowcoin", name: "ShadowCoin", icon: "🌒", atk: 40, def: 40, magic: 40, hp: 130 },
    { key: "cosmic", name: "CosmicCrunchEX", icon: "☄️", atk: 60, def: 30, magic: 25, hp: 140 },
    { key: "equilibrium", name: "Equilibrium", icon: "⚖️", atk: 35, def: 45, magic: 45, hp: 150 },
    { key: "jesus", name: "Jesus", icon: "⛪", atk: 25, def: 50, magic: 60, hp: 160 },
    { key: "owners", name: "Ownersv2", icon: "👨‍💻", atk: 70, def: 40, magic: 15, hp: 180 },
    { key: "prince", name: "PrinceHar", icon: "✅", atk: 50, def: 35, magic: 35, hp: 125 },
    { key: "yhander", name: "Yhander", icon: "⚔️", atk: 65, def: 25, magic: 30, hp: 135 }
  ],
  MOVES: {
    bash: { name: "Bash", icon: "🥊", type: "atk", base: 1.0 },
    hexsmash: { name: "Hex Smash", icon: "💥", type: "magic", base: 1.2 },
    fluxstrike: { name: "Flux Strike", icon: "🌩️", type: "atk", base: 0.9 },
    chaosbolt: { name: "Chaos Bolt", icon: "⚡", type: "magic", base: 1.4, crit: 0.2 },
    vitalsurge: { name: "Vital Surge", icon: "💖", type: "heal", base: 0.5 },
    guardpulse: { name: "Guard Pulse", icon: "🛡️", type: "defbuff", amount: 15 },
    statsync: { name: "Stat Sync", icon: "🔄", type: "atkbuff", amount: 12 },
    equilibrium: { name: "Equilibrium", icon: "⚖️", type: "special" }
  }
};

class Pet {
  constructor(data, gear = null) {
    this.key = data.key;
    this.name = data.name;
    this.icon = data.icon;
    this.baseAtk = data.atk;
    this.baseDef = data.def;
    this.baseMagic = data.magic;
    this.baseHp = data.hp;
    this.level = data.level || 1;
    this.atkModifier = 0;
    this.defModifier = 0;
    this.magicModifier = 0;
    this.hpModifier = 0;
    this.maxHpModifier = 0;
    this.HP = this.maxHP;
  }

  get ATK() { return Math.max(1, this.baseAtk + this.atkModifier); }
  get DF() { return Math.max(1, this.baseDef + this.defModifier); }
  get MAGIC() { return Math.max(1, this.baseMagic + this.magicModifier); }
  get maxHP() { return Math.max(1, this.baseHp + this.hpModifier + this.maxHpModifier); }

  getPercentHP() { return (this.HP / this.maxHP) * 100; }
  isDown() { return this.HP <= 0; }

  calculateAttack(defenderDF, overrideStat = null) {
    const stat = overrideStat !== null ? overrideStat : this.ATK;
    const damage = Math.max(1, Math.floor((stat * 2.5) / (defenderDF / 10 + 1)));
    const variance = 0.85 + Math.random() * 0.3;
    return Math.floor(damage * variance);
  }

  getPlayerUI(options = {}) {
    let text = `${this.icon} ${this.name} (Lv.${this.level})\n`;
    text += `❤️ HP: ${this.HP}/${this.maxHP} (${this.getPercentHP().toFixed(1)}%)\n`;
    if (options.showStats) {
      text += `⚔️ ATK: ${this.ATK} | 🛡️ DEF: ${this.DF} | ✨ MAG: ${this.MAGIC}\n`;
    }
    if (options.selectionOptions) {
      const moves = Object.keys(CONFIG.MOVES);
      text += `\n📜 Moves: ${moves.map(m => CONFIG.MOVES[m].icon).join(' ')}\n`;
      text += `Reply with: ${moves.join(', ')}`;
    }
    return text;
  }
}

const activeGames = new Map();

function calculatePetStrength(pet) {
  return (pet.ATK + pet.DF / 10 + pet.MAGIC + pet.maxHP + pet.ATK * 2.1) * 3.5;
}

function getRandomPet() {
  const idx = Math.floor(Math.random() * CONFIG.DEFAULT_PETS.length);
  return new Pet(CONFIG.DEFAULT_PETS[idx]);
}

async function generateAIPet(playerPet, requestedName = "") {
  let targetPet = null;
  if (requestedName) {
    const found = CONFIG.DEFAULT_PETS.find(p => p.name.toLowerCase() === requestedName.toLowerCase());
    if (found) targetPet = new Pet(found);
  }
  if (!targetPet) {
    const strength = calculatePetStrength(playerPet);
    let closest = null;
    let minDiff = Infinity;
    for (const p of CONFIG.DEFAULT_PETS) {
      const testPet = new Pet(p);
      const diff = Math.abs(calculatePetStrength(testPet) - strength);
      if (diff < minDiff) {
        minDiff = diff;
        closest = testPet;
      }
    }
    targetPet = closest || getRandomPet();
  }
  targetPet.HP = targetPet.maxHP;
  return { pet: targetPet, author: `AI_${Date.now()}` };
}

function generateAIMove(activePet, targetPet, prevMove) {
  const moves = Object.keys(CONFIG.MOVES);
  const randomMove = moves[Math.floor(Math.random() * moves.length)];
  return randomMove;
}

async function handleAttack(activePet, targetPet, move, stats) {
  const moveData = CONFIG.MOVES[move];
  if (!moveData) return { flavor: `${activePet.icon} ${activePet.name} ne connaît pas ${move}.`, damage: 0, heal: 0 };

  let flavor = `${activePet.icon} ${activePet.name} utilise ${moveData.icon} ${moveData.name} !\n`;
  let damage = 0;
  let heal = 0;

  switch (moveData.type) {
    case "atk":
      damage = activePet.calculateAttack(targetPet.DF);
      targetPet.HP -= damage;
      stats.totalDamageDealt += damage;
      flavor += `Inflige ${damage} dégâts !\n`;
      break;
    case "magic":
      damage = activePet.calculateAttack(targetPet.DF, activePet.MAGIC);
      if (moveData.crit && Math.random() < moveData.crit) {
        damage = Math.floor(damage * 1.5);
        flavor += `Coup critique ! `;
      }
      targetPet.HP -= damage;
      stats.totalDamageDealt += damage;
      flavor += `Inflige ${damage} dégâts magiques !\n`;
      break;
    case "heal":
      heal = Math.floor(activePet.MAGIC * moveData.base);
      heal = Math.min(heal, activePet.maxHP - activePet.HP);
      activePet.HP += heal;
      stats.healsPerformed += 1;
      flavor += `Restaure ${heal} PV.\n`;
      break;
    case "defbuff":
      activePet.defModifier += moveData.amount;
      stats.defenseBoosts += 1;
      flavor += `Défense augmentée de ${moveData.amount} !\n`;
      break;
    case "atkbuff":
      activePet.atkModifier += moveData.amount;
      stats.attackBoosts += 1;
      flavor += `Attaque augmentée de ${moveData.amount} !\n`;
      break;
    case "special":
      const hpDiff = targetPet.getPercentHP() - activePet.getPercentHP();
      if (hpDiff > 0) {
        damage = Math.floor(activePet.calculateAttack(targetPet.DF) * (hpDiff / 100));
        heal = Math.floor(activePet.MAGIC * (hpDiff / 100));
        damage = Math.min(damage, Math.floor(targetPet.maxHP * 0.25));
        heal = Math.min(heal, activePet.maxHP - activePet.HP);
        targetPet.HP -= damage;
        activePet.HP += heal;
        stats.totalDamageDealt += damage;
        flavor += `Inflige ${damage} dégâts et restaure ${heal} PV.\n`;
      } else {
        flavor += `Pas d'effet (HP adversaire non supérieur).\n`;
      }
      break;
  }
  return { flavor, damage, heal };
}

async function playTurn(message, gameId) {
  const game = activeGames.get(gameId);
  if (!game) return;

  const active = game.activePlayer === 1 ? game.player1Pet : game.player2Pet;
  const target = game.activePlayer === 1 ? game.player2Pet : game.player1Pet;
  const stats = game.activePlayer === 1 ? game.stats1 : game.stats2;
  const prevMove = game.activePlayer === 1 ? game.prevMove1 : game.prevMove2;
  const playerId = game.activePlayer === 1 ? game.player1Author : game.player2Author;

  const isAI = (game.isAIMode && game.activePlayer === 2);
  let move = null;

  if (isAI) {
    move = generateAIMove(active, target, prevMove);
    await processMove(message, gameId, move, playerId);
  } else {
    const prompt = `
${active.getPlayerUI({ showStats: true })}

Adversaire:
${target.getPlayerUI({ showStats: true })}

Tour ${game.turnCount + 1}/${CONFIG.MAX_TURNS}

Choisissez votre action:
🥊 bash | 💥 hexsmash | 🌩️ fluxstrike | ⚡ chaosbolt
💖 vitalsurge | 🛡️ guardpulse | 🔄 statsync | ⚖️ equilibrium

Répondez avec le nom de l'attaque.
    `;
    const replyMsg = await message.reply(fonts?.bold ? fonts.bold(prompt) : prompt);

    global.GoatBot.onReply.set(replyMsg.messageID, {
      commandName: "arena",
      author: playerId,
      gameId: gameId,
      activePetKey: active.key,
      targetPetKey: target.key,
      startTime: Date.now(),
      messageID: replyMsg.messageID
    });

    setTimeout(() => {
      const data = global.GoatBot.onReply.get(replyMsg.messageID);
      if (data && data.author === playerId) {
        message.reply(`⏰ Temps écoulé ! ${active.name} ne fait rien...`);
        global.GoatBot.onReply.delete(replyMsg.messageID);
        message.unsend(replyMsg.messageID).catch(() => {});
        game.turnCount++;
        game.activePlayer = game.activePlayer === 1 ? 2 : 1;
        playTurn(message, gameId);
      }
    }, 30000);
  }
}

async function processMove(message, gameId, move, playerId) {
  const game = activeGames.get(gameId);
  if (!game) return;

  const active = game.activePlayer === 1 ? game.player1Pet : game.player2Pet;
  const target = game.activePlayer === 1 ? game.player2Pet : game.player1Pet;
  const stats = game.activePlayer === 1 ? game.stats1 : game.stats2;

  const result = await handleAttack(active, target, move, stats);

  let log = result.flavor;
  log += `\n${active.icon} ${active.name} PV: ${active.HP}/${active.maxHP} | ${target.icon} ${target.name} PV: ${target.HP}/${target.maxHP}`;

  if (game.activePlayer === 1) game.prevMove1 = move;
  else game.prevMove2 = move;

  if (target.isDown()) {
    const winner = game.activePlayer === 1 ? 1 : 2;
    activeGames.delete(gameId);
    const winnerId = winner === 1 ? game.player1Author : game.player2Author;
    const loserId = winner === 1 ? game.player2Author : game.player1Author;
    const winnerData = await message.usersData.get(winnerId);
    const reward = Math.floor(CONFIG.BASE_REWARD * CONFIG.RATE_MULTIPLIER);
    await message.usersData.set(winnerId, { money: (winnerData.money || 0) + reward });
    const winMsg = `🏆 Victoire ! ${winner === 1 ? game.player1Pet.name : game.player2Pet.name} remporte le combat !\n💰 Gain: ${reward} coins.`;
    return message.reply(fonts?.bold ? fonts.bold(`${log}\n\n${winMsg}`) : `${log}\n\n${winMsg}`);
  }

  game.turnCount++;
  if (game.turnCount >= CONFIG.MAX_TURNS) {
    activeGames.delete(gameId);
    const hp1 = game.player1Pet.getPercentHP();
    const hp2 = game.player2Pet.getPercentHP();
    const winner = hp1 > hp2 ? 1 : 2;
    const winnerId = winner === 1 ? game.player1Author : game.player2Author;
    const winnerData = await message.usersData.get(winnerId);
    const reward = Math.floor(CONFIG.BASE_REWARD / 2);
    await message.usersData.set(winnerId, { money: (winnerData.money || 0) + reward });
    const drawMsg = `⏰ Limite de tours atteinte ! ${winner === 1 ? game.player1Pet.name : game.player2Pet.name} gagne avec plus de PV restants.\n💰 Gain: ${reward} coins.`;
    return message.reply(fonts?.bold ? fonts.bold(`${log}\n\n${drawMsg}`) : `${log}\n\n${drawMsg}`);
  }

  game.activePlayer = game.activePlayer === 1 ? 2 : 1;
  await message.reply(fonts?.bold ? fonts.bold(log) : log);
  await playTurn(message, gameId);
}

module.exports = {
  config: {
    name: "arena",
    aliases: ["pvp", "battle"],
    version: "1.0.1",
    author: "Christus",
    countDown: 5,
    role: 0,
    description: "⚔️ Combat PvP ou contre IA avec vos pets",
    category: "game",
    guide: {
      fr: "{pn} <nom du pet> --ai\n{pn} <nom du pet> <nom du pet adverse>\nExemple: !arena PhilCassidy --ai"
    }
  },

  onStart: async function ({ message, event, args, usersData, api }) {
    const { senderID } = event;
    const isAIMode = args.includes("--ai");
    let petName = args[0];
    let opponentPetName = isAIMode ? args[1] : args[1];

    if (!petName) {
      const helpMsg = `
⚔️ Arène de combat
━━━━━━━━━━━━━━━━━

❌ Veuillez spécifier le nom de votre pet.

📌 Utilisation:
• ${this.config.name} <pet> --ai (combat contre IA)
• ${this.config.name} <pet> <pet adverse> (PvP)

📋 Pets disponibles:
${CONFIG.DEFAULT_PETS.map(p => `${p.icon} ${p.name}`).join(', ')}
      `.trim();
      return message.reply(fonts?.bold ? fonts.bold(helpMsg) : helpMsg);
    }

    let userData = await usersData.get(senderID);
    // Initialisation des champs manquants
    if (!userData.pets) userData.pets = [];
    if (!userData.inventory) userData.inventory = [];
    if (!userData.money) userData.money = 0;

    let userPets = userData.pets;
    if (userPets.length === 0) {
      // Donner des pets par défaut si le joueur n'en a aucun
      userPets = CONFIG.DEFAULT_PETS.map(p => ({ ...p, level: 1, HP: p.hp, maxHP: p.hp, ATK: p.atk, DEF: p.def, MAGIC: p.magic, lastExp: 0, lastFeed: Date.now(), lastSaturation: 0 }));
      userData.pets = userPets;
      await usersData.set(senderID, userData);
      userData = await usersData.get(senderID);
      userPets = userData.pets;
    }

    const myPetData = userPets.find(p => p.name.toLowerCase() === petName.toLowerCase());
    if (!myPetData) {
      const msg = `❌ Pet "${petName}" non trouvé. Utilisez !pet list pour voir vos pets.`;
      return message.reply(fonts?.bold ? fonts.bold(msg) : msg);
    }

    const myPet = new Pet(myPetData);
    let opponentPet = null;
    let opponentAuthor = null;

    if (isAIMode) {
      const aiResult = await generateAIPet(myPet, opponentPetName);
      opponentPet = aiResult.pet;
      opponentAuthor = aiResult.author;
    } else {
      if (!opponentPetName) {
        const msg = "❌ Pour un combat PvP, spécifiez le nom du pet adverse.";
        return message.reply(fonts?.bold ? fonts.bold(msg) : msg);
      }
      const replyMsg = await message.reply(`⚔️ ${userData.name || message.author} défie les autres joueurs ! Envoyez le nom de votre pet pour combattre.`);
      const filter = (replyEvent) => replyEvent.senderID !== senderID;
      const collected = await new Promise(resolve => {
        global.GoatBot.onReply.set(replyMsg.messageID, {
          commandName: this.config.name,
          author: senderID,
          filter,
          callback: (ctx) => resolve(ctx)
        });
      });
      if (!collected) return message.reply("❌ Combat annulé.");
      const challengerData = await usersData.get(collected.senderID);
      const challengerPets = challengerData.pets || [];
      const challengerPetData = challengerPets.find(p => p.name.toLowerCase() === collected.body.toLowerCase());
      if (!challengerPetData) {
        return message.reply(`❌ ${collected.senderName} n'a pas le pet "${collected.body}".`);
      }
      opponentPet = new Pet(challengerPetData);
      opponentAuthor = collected.senderID;
    }

    const gameId = `${senderID}_${Date.now()}`;
    const gameState = {
      player1Pet: myPet,
      player2Pet: opponentPet,
      player1Author: senderID,
      player2Author: opponentAuthor,
      activePlayer: calculatePetStrength(myPet) >= calculatePetStrength(opponentPet) ? 1 : 2,
      turnCount: 0,
      isAIMode: isAIMode,
      prevMove1: null,
      prevMove2: null,
      stats1: { totalDamageDealt: 0, totalDamageTaken: 0, defenseBoosts: 0, attackBoosts: 0, healsPerformed: 0 },
      stats2: { totalDamageDealt: 0, totalDamageTaken: 0, defenseBoosts: 0, attackBoosts: 0, healsPerformed: 0 }
    };
    activeGames.set(gameId, gameState);

    await playTurn(message, gameId);
  },

  onReply: async function ({ message, event, Reply, api, usersData }) {
    if (Reply.author !== event.senderID) return;

    const { gameId, startTime, messageID } = Reply;
    const timeSpent = (Date.now() - startTime) / 1000;
    if (timeSpent > 30) {
      return message.reply("⏰ Temps dépassé !");
    }

    const move = event.body.trim().toLowerCase();
    const validMoves = Object.keys(CONFIG.MOVES);
    if (!validMoves.includes(move)) {
      return message.reply(`❌ Mouvement invalide. Choisissez parmi: ${validMoves.join(', ')}`);
    }

    message.unsend(messageID).catch(() => {});
    global.GoatBot.onReply.delete(messageID);
    await processMove(message, gameId, move, Reply.author);
  }
};