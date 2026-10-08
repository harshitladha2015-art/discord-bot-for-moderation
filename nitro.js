const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  AttachmentBuilder,
  ActivityType,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ComponentType,
  REST,
  Routes
} = require("discord.js");

const client = new Client({
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const config = require("./config.json");
const express = require("express");
const app = express();
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const moderation = require("./moderation.js");

// Support .env files for environment variables
if (fs.existsSync(path.join(__dirname, ".env"))) {
  try {
    require("dotenv").config();
  } catch (e) {
    // dotenv not installed, will use config.json only
  }
}

// Override config with environment variables if they exist
const finalConfig = {
  token: process.env.TOKEN || config.token,
  prefix: process.env.PREFIX || config.prefix || "$",
  guildId: process.env.GUILD_ID || config.guildId
};

const port = Number(process.env.PORT || 0);
const ANNOUNCEMENTS_CHANNEL_ID = "1553419627973841116";
const PROOF_CHANNEL_ID = "1553371496838078548";
const BOOSTER_REWARD_ROLE_ID = "1556013421554569297";
const GENERATED_PROOF_CHANNEL_ID = "1556002854312087728";
const DAILY_LEADERBOARD_COMMAND_CHANNEL_ID = "1556002854312087729";
const DAILY_LEADERBOARD_COMMAND_INTERVAL = 24 * 60 * 60 * 1000;
const PANEL_COMMANDS = [
  { name: "panel", description: "Send the invite panel" },
  { name: "panel-2", description: "Send the Nitro request panel" },
  { name: "leaderboard", description: "Show the invite leaderboard" },
  { name: "send", description: "Trigger the other bot's leaderboard command" },
  { name: "dock", description: "Create or update a member-count voice channel" },
  { name: "invite-stats", description: "View server invite statistics and top inviters" },
  {
    name: "check-invites",
    description: "Check a user's invite statistics",
    options: [
      { name: "user", description: "The user to check invites for", type: 6, required: true }
    ]
  },
  {
    name: "add-invite",
    description: "Add manual invite credits to a user (Manage Server required)",
    options: [
      { name: "amount", description: "Number of invites to add", type: 4, required: true, minValue: 1 },
      { name: "user", description: "The user to add invites to", type: 6, required: true }
    ]
  },
  {
    name: "remove-invite",
    description: "Remove manual invite credits from a user (Manage Server required)",
    options: [
      { name: "amount", description: "Number of invites to remove", type: 4, required: true, minValue: 1 },
      { name: "user", description: "The user to remove invites from", type: 6, required: true }
    ]
  },
  {
    name: "ban",
    description: "Ban a user from the server (Manage Server required)",
    options: [
      { name: "user", description: "The user to ban", type: 6, required: true },
      { name: "reason", description: "Reason for the ban", type: 3, required: false }
    ]
  },
  {
    name: "kick",
    description: "Kick a user from the server (Manage Server required)",
    options: [
      { name: "user", description: "The user to kick", type: 6, required: true },
      { name: "reason", description: "Reason for the kick", type: 3, required: false }
    ]
  },
  {
    name: "warn",
    description: "Warn a user (Manage Server required)",
    options: [
      { name: "user", description: "The user to warn", type: 6, required: true },
      { name: "reason", description: "Reason for the warning", type: 3, required: true }
    ]
  },
  {
    name: "timeout",
    description: "Timeout a user (Manage Server required)",
    options: [
      { name: "user", description: "The user to timeout", type: 6, required: true },
      { name: "duration", description: "Duration (e.g., 1h, 30m, 1d)", type: 3, required: true },
      { name: "reason", description: "Reason for the timeout", type: 3, required: false }
    ]
  },
  {
    name: "warns",
    description: "Check warns for a user",
    options: [
      { name: "user", description: "The user to check", type: 6, required: true }
    ]
  },
  {
    name: "clear-warns",
    description: "Clear a user's warns (Manage Server required)",
    options: [
      { name: "user", description: "The user to clear warns for", type: 6, required: true }
    ]
  },
  {
    name: "clear",
    description: "Clear messages from a channel (Manage Server required)",
    options: [
      { name: "amount", description: "Number of messages to clear", type: 4, required: true, minValue: 1, maxValue: 100 }
    ]
  },
  {
    name: "giveaway",
    description: "Manage giveaways",
    options: [
      {
        name: "start",
        description: "Start a giveaway",
        type: 1,
        options: [
          { name: "duration", description: "Example: 2h, 30m", type: 3, required: true },
          { name: "winners", description: "Number of winners", type: 4, required: true },
          { name: "prize", description: "Prize name", type: 3, required: true },
          { name: "invites", description: "Required invite count", type: 4, required: true }
        ]
      },
      {
        name: "cancel",
        description: "Cancel an active giveaway",
        type: 1,
        options: [
          { name: "giveaway-id", description: "Giveaway ID shown in the giveaway post", type: 3, required: true }
        ]
      },
      {
        name: "reroll",
        description: "Reroll winners for a giveaway",
        type: 1,
        options: [
          { name: "giveaway-id", description: "ID of giveaway to reroll", type: 3, required: true }
        ]
      },
      {
        name: "list",
        description: "List all active giveaways",
        type: 1
      }
    ]
  }
];
const dockChannels = new Map();
const renderSessions = new Map();
let rendererUrl;

function getAnnouncementsRole(guild) {
  return guild?.roles.cache.find(role => /announcements/i.test(role.name)) || null;
}

function getProofRole(guild) {
  return guild?.roles.cache.find(role => /proof/i.test(role.name)) || null;
}

function buildNitroClaimMessage(user, inviteCount) {
  return inviteCount >= 2
    ? `Hello ${user}, your Nitro is on the way. Because there is a lot of demand, it will take 7 days for it to be delivered, if you would like instant claim, invite 2 more people to the server and claim it instantly.`
    : `Sorry, you don't have enough active invites to claim Nitro. You currently have ${inviteCount}; you need 2.`;
}

const NITRO_REWARDS = {
  classic_month: { name: "Nitro Classic", duration: "1 month", invites: 2 },
  booster_month: { name: "Nitro Booster", duration: "1 month", invites: 4 },
  classic_year: { name: "Nitro Classic", duration: "1 year", invites: 10 },
  booster_year: { name: "Nitro Booster", duration: "1 year", invites: 15 }
};

function getDockName(guild) {
  if (!guild) return "📊 Server Stats";
  const memberCount = guild.memberCount || 0;
  const boosters = guild.premiumSubscriptionCount || 0;
  return `👥 Members: ${memberCount} | 🚀 Boosts: ${boosters}`;
}

async function updateDockChannel(channel) {
  if (!channel || channel.type !== ChannelType.GuildVoice) return;
  
  try {
    const newName = getDockName(channel.guild);
    if (channel.name !== newName) {
      await channel.setName(newName).catch(() => {});
    }
  } catch (error) {
    console.error(`Could not update dock channel ${channel.id}:`, error);
  }
}

async function refreshDockForGuild(guild) {
  if (!guild) return null;

  const channelId = dockChannels.get(guild.id);
  if (channelId) {
    const existing = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
    if (existing && existing.type === ChannelType.GuildVoice) {
      await updateDockChannel(existing);
      return existing;
    }
    dockChannels.delete(guild.id);
  }

  const fallbackChannel = guild.channels.cache.find(channel => channel.type === ChannelType.GuildVoice) || null;
  return ensureDockChannel(guild, fallbackChannel || null);
}

async function ensureDockChannel(guild, originChannel) {
  if (!guild) return null;

  const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
  if (!me || !me.permissions.has("ManageChannels")) {
    throw new Error("Missing Manage Channels permission");
  }

  const existingId = dockChannels.get(guild.id);
  if (existingId) {
    const existing = guild.channels.cache.get(existingId) || await guild.channels.fetch(existingId).catch(() => null);
    if (existing && existing.type === ChannelType.GuildVoice) {
      await updateDockChannel(existing);
      return existing;
    }
    dockChannels.delete(guild.id);
  }

  try {
    const dockCategoryName = "📊 Server Stats";
    let dockCategory = guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === dockCategoryName);
    
    if (!dockCategory && originChannel && originChannel.parentId) {
      dockCategory = guild.channels.cache.get(originChannel.parentId);
    }

    const created = await guild.channels.create({
      name: getDockName(guild),
      type: ChannelType.GuildVoice,
      parent: dockCategory?.id || (originChannel && originChannel.parentId ? originChannel.parentId : null),
      reason: "Dock channel created by /dock command",
      userLimit: 0
    });

    dockChannels.set(guild.id, created.id);
    await updateDockChannel(created);
    return created;
  } catch (error) {
    console.error(`Could not create dock channel for guild ${guild.id}:`, error);
    return null;
  }
}

app.get("/font", function (e, t) {
  const a = `${__dirname}/Whitneyfont.woff`;
  t.sendFile(a);
});
app.get("/nitroboost.png", function (e, t) {
  t.sendFile(`${__dirname}/images/1.PNG`);
});
app.get("/nitroclassic.png", function (e, t) {
  t.sendFile(`${__dirname}/images/2.PNG`);
});
app.get("/render/:id", function (e, t) {
  const html = renderSessions.get(e.params.id);
  if (!html) {
    t.sendStatus(404);
    return;
  }
  t.type("html").send(html);
});

const renderServer = app.listen(port, "127.0.0.1");
const rendererReady = new Promise((resolve, reject) => {
  renderServer.once("listening", () => {
    const address = renderServer.address();
    if (!address || typeof address === "string") {
      reject(new Error("Local renderer did not bind to a TCP port."));
      return;
    }
    rendererUrl = `http://127.0.0.1:${address.port}`;
    console.log(`Renderer listening at ${rendererUrl}`);
    resolve();
  });
  renderServer.once("error", reject);
});
rendererReady.catch(error => console.error("Could not start local renderer:", error));

const inviteTrackerFile = path.join(__dirname, "invite-tracker.json");
let inviteTracker = loadInviteTracker();
let inviteTrackerWrite = Promise.resolve();
const inviteTrackingQueues = new Map();
const pendingInviteAttributions = new Map();

function queueInviteTracking(guildId, task) {
  const previous = inviteTrackingQueues.get(guildId) || Promise.resolve();
  const queued = previous.catch(() => {}).then(task);
  inviteTrackingQueues.set(guildId, queued);
  return queued.finally(() => {
    if (inviteTrackingQueues.get(guildId) === queued) {
      inviteTrackingQueues.delete(guildId);
    }
  });
}

function loadInviteTracker() {
  let contents;
  try {
    contents = fs.readFileSync(inviteTrackerFile, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return { guilds: {} };
    throw error;
  }

  const saved = JSON.parse(contents);
  if (!saved || typeof saved.guilds !== "object" || Array.isArray(saved.guilds)) {
    throw new Error("Invite tracker data must contain a guilds object.");
  }
  return saved;
}

function getInviteState(guildId) {
  if (!inviteTracker.guilds[guildId]) {
    inviteTracker.guilds[guildId] = {
      initialized: false,
      invites: {},
      members: {},
      manualInvites: {}
    };
  }

  const state = inviteTracker.guilds[guildId];
  state.invites = state.invites || {};
  state.members = state.members || {};
  state.manualInvites = state.manualInvites || {};
  return state;
}

function ensureInviteTotals(state, snapshot = {}) {
  if (state.inviteTotals) return;

  const totals = {};
  Object.values(snapshot).forEach(invite => {
    if (invite.inviterId) {
      totals[invite.inviterId] = (totals[invite.inviterId] || 0) + Number(invite.uses || 0);
    }
  });
  const activeCounts = {};
  Object.values(state.members).forEach(inviterId => {
    activeCounts[inviterId] = (activeCounts[inviterId] || 0) + 1;
  });
  Object.entries(activeCounts).forEach(([inviterId, count]) => {
    totals[inviterId] = Math.max(totals[inviterId] || 0, count);
  });
  state.inviteTotals = totals;
}

function createInviteStats(state) {
  const stats = {
    activeCounts: {},
    lifetotals: {},
    manual: {}
  };

  Object.entries(state.members).forEach(([memberId, inviterId]) => {
    stats.activeCounts[inviterId] = (stats.activeCounts[inviterId] || 0) + 1;
  });

  Object.entries(state.inviteTotals || {}).forEach(([inviterId, total]) => {
    stats.lifetotals[inviterId] = total;
  });

  Object.entries(state.manualInvites || {}).forEach(([inviterId, bonus]) => {
    stats.manual[inviterId] = Number(bonus || 0);
  });

  return stats;
}

function saveInviteTracker() {
  const write = inviteTrackerWrite
    .catch(() => {})
    .then(async () => {
      const tempFile = `${inviteTrackerFile}.${process.pid}.tmp`;
      await fs.promises.writeFile(tempFile, JSON.stringify(inviteTracker, null, 2));
      await fs.promises.rename(tempFile, inviteTrackerFile);
    });
  inviteTrackerWrite = write;
  return write;
}

async function fetchInviteSnapshot(guild) {
  if (!guild || typeof guild.fetchInvites !== "function") {
    return null;
  }

  let invites;
  try {
    invites = await guild.fetchInvites();
  } catch (error) {
    console.error(
      `Could not fetch invites for guild ${guild.id}; verify that the bot has Manage Server permission:`,
      error
    );
    return null;
  }

  const snapshot = {};
  invites.forEach(invite => {
    snapshot[invite.code] = {
      uses: invite.uses || 0,
      inviterId: invite.inviter ? invite.inviter.id : null
    };
  });
  return snapshot;
}

async function initializeInviteTracking(guild) {
  if (!guild || typeof guild.fetchInvites !== "function") return;

  return queueInviteTracking(guild.id, async () => {
    const snapshot = await fetchInviteSnapshot(guild);
    if (!snapshot) return;

    const state = getInviteState(guild.id);
    ensureInviteTotals(state, snapshot);
    state.invites = snapshot;
    state.initialized = true;
    pendingInviteAttributions.delete(guild.id);
    await saveInviteTracker();
  });
}

async function trackMemberJoin(member) {
  if (!member.guild || (member.user && member.user.bot)) return;

  return queueInviteTracking(member.guild.id, async () => {
    const state = getInviteState(member.guild.id);
    if (!state.initialized) {
      const initialSnapshot = await fetchInviteSnapshot(member.guild);
      if (!initialSnapshot) return;
      state.invites = initialSnapshot;
      state.initialized = true;
      await saveInviteTracker();
    }
    const needsTotalsMigration = !state.inviteTotals;
    ensureInviteTotals(state, state.invites);
    if (!state.invites || typeof state.invites !== "object") {
      state.invites = {};
    }
    if (needsTotalsMigration) await saveInviteTracker();

    let snapshot = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      const currentSnapshot = await fetchInviteSnapshot(member.guild);
      if (!currentSnapshot) continue;
      snapshot = currentSnapshot;

      const pending = pendingInviteAttributions.get(member.guild.id) || [];
      for (const [code, current] of Object.entries(currentSnapshot)) {
        const previous = state.invites[code];
        if (previous && previous.inviterId && previous.inviterId !== current.inviterId) continue;
        if (!current.inviterId) continue;

        const increase = current.uses - (previous ? previous.uses || 0 : 0);
        for (let use = 0; use < increase; use += 1) {
          pending.push(current.inviterId);
        }
      }
      state.invites = currentSnapshot;
      pendingInviteAttributions.set(member.guild.id, pending);
      if (pending.length > 0) break;
    }

    if (!snapshot) return;

    const pending = pendingInviteAttributions.get(member.guild.id) || [];
    const inviterId = pending.shift();
    pendingInviteAttributions.set(member.guild.id, pending);
    if (inviterId) {
      state.members[member.id] = inviterId;
      state.inviteTotals[inviterId] = Number(state.inviteTotals[inviterId] || 0) + 1;
    } else {
      console.warn(
        `Could not determine which invite ${member.user.tag} (${member.id}) used in guild ${member.guild.id}.`
      );
      delete state.members[member.id];
    }
    await saveInviteTracker();
  });
}

async function trackMemberLeave(member) {
  if (!member.guild) return;

  return queueInviteTracking(member.guild.id, async () => {
    const state = getInviteState(member.guild.id);
    if (state.members[member.id]) {
      delete state.members[member.id];
      await saveInviteTracker();
    }
  });
}

async function countActiveInvitees(guild, inviterId) {
  const state = getInviteState(guild.id);
  let count = 0;
  let changed = false;

  await Promise.all(
    Object.entries(state.members).map(async ([memberId, memberInviterId]) => {
      if (memberInviterId !== inviterId) return;

      let member = guild.members.cache.get(memberId);
      if (!member) {
        try {
          member = await guild.members.fetch(memberId);
        } catch (error) {
          if (error && (error.code === 10007 || error.status === 404)) {
            delete state.members[memberId];
            changed = true;
            return;
          }
          throw error;
        }
      }
      count += 1;
    })
  );

  if (changed) await saveInviteTracker();
  return count + Number(state.manualInvites[inviterId] || 0);
}

const leaderboardBoards = new Map();

function createLeaderboardEmbed(guild) {
  const state = getInviteState(guild.id);
  const stats = createInviteStats(state);
  
  const combinedScores = {};
  Object.keys(new Set([
    ...Object.keys(stats.activeCounts),
    ...Object.keys(stats.lifetotals),
    ...Object.keys(stats.manual)
  ])).forEach(inviterId => {
    const active = stats.activeCounts[inviterId] || 0;
    const lifetime = stats.lifetotals[inviterId] || 0;
    const manual = stats.manual[inviterId] || 0;
    combinedScores[inviterId] = { active, lifetime, manual, total: active + manual };
  });

  const topInviters = Object.entries(combinedScores)
    .sort((a, b) => (b[1].total) - (a[1].total))
    .slice(0, 10);

  const rows = topInviters.map(([inviterId, counts], index) => {
    const member = guild.members.cache.get(inviterId);
    const name = member ? member.user.tag : `<@${inviterId}>`;
    const activeStr = `${counts.active}${counts.active === 1 ? "" : "s"}`;
    const manualStr = counts.manual > 0 ? ` +${counts.manual}` : "";
    return `**${index + 1}.** ${name} — **${counts.total}** total (${activeStr}${manualStr})`;
  });

  return new EmbedBuilder()
    .setTitle("🏆 Invite Leaderboard")
    .setDescription(rows.length ? rows.join("\n") : "No tracked active invitees yet.")
    .addFields(
      { name: "Format", value: "`[active invites] + [manual credits]`", inline: false }
    )
    .setColor("#5865F2")
    .setFooter({ text: "Updates every 2 seconds • Track active members who joined via your invite" });
}

async function refreshLeaderboard(board) {
  if (!board || !board.message || board.message.deleted) {
    clearInterval(board.timer);
    leaderboardBoards.delete(board.key);
    return;
  }

  try {
    await board.message.edit({ embeds: [createLeaderboardEmbed(board.guild)] });
  } catch (error) {
    if (error?.code === 10008 || error?.code === 50001 || error?.message?.includes("Unknown Message")) {
      clearInterval(board.timer);
      leaderboardBoards.delete(board.key);
      return;
    }
    throw error;
  }
}

async function sendLeaderboard(e) {
  const key = `${e.guild.id}:${e.channel.id}`;
  const existing = leaderboardBoards.get(key);
  if (existing && !existing.message.deleted) {
    await refreshLeaderboard(existing);
    return;
  }

  const message = await e.channel.send({ embeds: [createLeaderboardEmbed(e.guild)] });
  const board = {
    key,
    guild: e.guild,
    message,
    timer: null
  };
  board.timer = setInterval(() => {
    refreshLeaderboard(board).catch(error =>
      console.error("Could not refresh invite leaderboard:", error)
    );
  }, 2000);
  leaderboardBoards.set(key, board);
}

async function sendDailyLeaderboardCommand() {
  const channel = await client.channels.fetch(DAILY_LEADERBOARD_COMMAND_CHANNEL_ID);
  if (!channel || !channel.isTextBased() || typeof channel.send !== "function") {
    throw new Error(
      `Daily leaderboard command channel ${DAILY_LEADERBOARD_COMMAND_CHANNEL_ID} is unavailable or not text-based.`
    );
  }

  await channel.send("!leaderboard");
  console.log(`Sent daily !leaderboard command to channel ${channel.id}.`);
}

const giveawayFile = path.join(__dirname, "giveaways.json");
let giveawayData = loadGiveawayData();
let giveawayWrite = Promise.resolve();
const giveawayTimers = new Map();
const boostGiveawayTimers = new Map();
const boostGiveawayRetryDelays = new Map();
const boostGiveawayChecks = new Set();
const boostGiveawayFinishing = new Set();

function generateGiveawayId() {
  let id;
  do {
    id = `GW-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
  } while (giveawayData.giveaways[id]);
  return id;
}

function loadGiveawayData() {
  try {
    const saved = JSON.parse(fs.readFileSync(giveawayFile, "utf8"));
    return saved && saved.giveaways ? saved : { giveaways: {} };
  } catch (error) {
    return { giveaways: {} };
  }
}

function saveGiveawayData() {
  const write = giveawayWrite
    .catch(() => {})
    .then(async () => {
      const tempFile = `${giveawayFile}.${process.pid}.tmp`;
      await fs.promises.writeFile(tempFile, JSON.stringify(giveawayData, null, 2));
      await fs.promises.rename(tempFile, giveawayFile);
    });
  giveawayWrite = write;
  return write.catch(error => {
    console.error("Could not save giveaways:", error);
    throw error;
  });
}

function parseDuration(value) {
  if (!value || typeof value !== "string") return null;

  const input = value.trim().toLowerCase();
  const parts = [...input.matchAll(/(\d+)\s*(s|m|h|d|w)/g)];
  if (
    !parts.length ||
    parts.map(part => part[0]).join("").replace(/\s+/g, "") !== input.replace(/\s+/g, "")
  ) {
    return null;
  }

  const units = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000 };
  const total = parts.reduce(
    (sum, part) => sum + Number(part[1]) * units[part[2]],
    0
  );

  return total > 0 && total <= 30 * 86400000 ? total : null;
}

function giveawayEmbed(giveaway, ended = false) {
  const requiredInvites = Number(giveaway.requiredInvites || 0);
  const description = ended
    ? giveaway.winnerIds.length
      ? `Winner${giveaway.winnerIds.length === 1 ? "" : "s"}: ${giveaway.winnerIds
          .map(id => `<@${id}>`)
          .join(", ")}\n\nWinners: please DM the server owners to claim your prize.`
      : "The giveaway ended without any eligible entries."
    : [
        "Click **Join** below to enter. Use **Leave** if you change your mind.",
        requiredInvites
          ? `You need at least **${requiredInvites} active invite${requiredInvites === 1 ? "" : "s"}** to qualify.`
          : "Everyone is eligible to enter.",
        `⏳ Ends <t:${Math.floor(giveaway.endsAt / 1000)}:R>`,
        "Good luck! 🍀"
      ].join("\n");

  return new EmbedBuilder()
    .setTitle(`🎉 Giveaway: ${giveaway.prize}`)
    .setDescription(description)
    .addFields(
      { name: "Winners", value: String(giveaway.winnerCount), inline: true },
      { name: "Entries", value: String(giveaway.participants.length), inline: true },
      {
        name: "Requirement",
        value: requiredInvites ? `${requiredInvites} invite${requiredInvites === 1 ? "" : "s"}` : "None",
        inline: true
      },
      { name: "Giveaway ID", value: `\`${giveaway.id}\``, inline: false }
    )
    .setColor(ended ? "#747f8d" : "#5865F2")
    .setFooter({ text: ended ? "Giveaway ended • Winners should DM the server owners" : "Enter or withdraw using the buttons below" })
    .setTimestamp(new Date(giveaway.endsAt));
}

function giveawayComponents(giveaway, disabled = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`giveaway:join:${giveaway.id}`)
        .setLabel("Join")
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(`giveaway:leave:${giveaway.id}`)
        .setLabel("Leave")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled)
    )
  ];
}

function boostGiveawayEmbed(giveaway, boosts, ended = false) {
  const description = ended
    ? giveaway.winnerIds.length
      ? `Winner${giveaway.winnerIds.length === 1 ? "" : "s"}: ${giveaway.winnerIds
          .map(id => `<@${id}>`)
          .join(", ")}\n\nWinners: please DM the server owners to claim your prize.`
      : "The giveaway ended without any eligible entrants."
    : `Only members with the **Server Booster** role can enter.\n` +
      `This giveaway ends when the server reaches **${giveaway.boostGoal} boosts**.\n` +
      `Current boosts: **${boosts ?? "unknown"}**`;

  return new EmbedBuilder()
    .setTitle(`🚀 Booster Giveaway: ${giveaway.prize}`)
    .setDescription(description)
    .addFields(
      { name: "Winners", value: String(giveaway.winnerCount), inline: true },
      { name: "Entrants", value: String(giveaway.participants.length), inline: true },
      { name: "Boost goal", value: String(giveaway.boostGoal), inline: true },
      { name: "Giveaway ID", value: `\`${giveaway.id}\``, inline: false }
    )
    .setColor(ended ? "#747f8d" : "#f47fff")
    .setFooter({ text: ended ? "Giveaway ended" : "Server Booster role required to enter" });
}

function boostGiveawayComponents(giveaway, disabled = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`boostgiveaway:enter:${giveaway.id}`)
        .setLabel("Enter")
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(`boostgiveaway:leave:${giveaway.id}`)
        .setLabel("Leave")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled)
    )
  ];
}

async function getGiveawayMessage(giveaway) {
  const guild = client.guilds.cache.get(giveaway.guildId);
  const channel = guild && guild.channels.cache.get(giveaway.channelId);
  if (!channel || !channel.messages) return null;

  return channel.messages.cache.get(giveaway.messageId) ||
    (await channel.messages.fetch(giveaway.messageId).catch(() => null));
}

async function updateGiveawayMessage(giveaway, ended = false) {
  const message = await getGiveawayMessage(giveaway);
  if (!message) return;

  await message.edit({
    embeds: [giveawayEmbed(giveaway, ended)],
    components: giveawayComponents(giveaway, ended)
  }).catch(error => console.error("Could not update giveaway message:", error));
}

async function updateBoostGiveawayMessage(giveaway, ended = false) {
  const message = await getGiveawayMessage(giveaway);
  if (!message) return;

  await message.edit({
    embeds: [boostGiveawayEmbed(giveaway, message.guild.premiumSubscriptionCount, ended)],
    components: boostGiveawayComponents(giveaway, ended)
  }).catch(error => console.error("Could not update booster giveaway message:", error));
}

function getBoosterRole(guild) {
  return guild.roles.cache.find(role => role.name.toLowerCase() === "server booster");
}

function stopBoostGiveawayMonitor(giveawayId) {
  const timer = boostGiveawayTimers.get(giveawayId);
  if (timer) clearTimeout(timer);
  boostGiveawayTimers.delete(giveawayId);
  boostGiveawayRetryDelays.delete(giveawayId);
}

async function finishBoostGiveaway(id) {
  const giveaway = giveawayData.giveaways[id];
  if (!giveaway || giveaway.ended || boostGiveawayFinishing.has(id)) return;
  boostGiveawayFinishing.add(id);

  try {
    const guild = client.guilds.cache.get(giveaway.guildId);
    const boosterRole = guild && getBoosterRole(guild);
    const eligibleParticipants = [];
    if (guild && boosterRole) {
      for (const userId of new Set(giveaway.participants)) {
        let member = guild.members.cache.get(userId);
        if (!member) {
          try {
            member = await guild.members.fetch(userId);
          } catch (error) {
            if (error && (error.code === 10007 || error.status === 404)) continue;
            throw error;
          }
        }
        if (member.roles.cache.has(boosterRole.id)) {
          eligibleParticipants.push(userId);
        }
      }
    }

    giveaway.ended = true;
    giveaway.winnerIds = [];
    while (giveaway.winnerIds.length < Math.min(giveaway.winnerCount, eligibleParticipants.length)) {
      const index = Math.floor(Math.random() * eligibleParticipants.length);
      giveaway.winnerIds.push(eligibleParticipants.splice(index, 1)[0]);
    }

    try {
      await saveGiveawayData();
    } catch (error) {
      giveaway.ended = false;
      giveaway.winnerIds = [];
      throw error;
    }
    stopBoostGiveawayMonitor(id);
    await updateBoostGiveawayMessage(giveaway, true);

    const message = await getGiveawayMessage(giveaway);
    if (!message) return;

    const winnerText = giveaway.winnerIds.length
      ? giveaway.winnerIds.map(userId => `<@${userId}>`).join(", ")
      : "Nobody";
    await message.channel
      .send(
        `🚀 The server reached ${giveaway.boostGoal} boosts! Booster giveaway for **${giveaway.prize}** ended. ` +
          `Winner${giveaway.winnerIds.length === 1 ? "" : "s"}: ${winnerText}` +
          (giveaway.winnerIds.length ? "\nWinners: please DM the server owners to claim your prize." : "")
      )
      .catch(error => console.error("Could not announce booster giveaway:", error));
    await Promise.all(
      giveaway.winnerIds.map(async userId => {
        const user = await client.users.fetch(userId).catch(() => null);
        if (user) {
          await user.send(
            `🚀 You won the booster giveaway for **${giveaway.prize}**! Please DM the server owners to claim your prize.`
          ).catch(() => {});
        }
      })
    );
  } finally {
    boostGiveawayFinishing.delete(id);
  }
}

async function checkBoostGiveaway(id) {
  const giveaway = giveawayData.giveaways[id];
  if (!giveaway || giveaway.ended || !giveaway.boostGoal) return true;
  if (boostGiveawayChecks.has(id)) return false;

  const guild = client.guilds.cache.get(giveaway.guildId);
  if (!guild) return false;

  boostGiveawayChecks.add(id);
  try {
    await guild.fetch();
    await updateBoostGiveawayMessage(giveaway);
    if (guild.premiumSubscriptionCount >= giveaway.boostGoal) {
      await finishBoostGiveaway(id);
    }
    return true;
  } catch (error) {
    console.warn(`Could not check boost goal for giveaway ${id}; will retry with backoff:`, error);
    return false;
  } finally {
    boostGiveawayChecks.delete(id);
  }
}

async function pollBoostGiveaway(id) {
  const giveaway = giveawayData.giveaways[id];
  if (!giveaway || giveaway.ended) {
    stopBoostGiveawayMonitor(id);
    return;
  }

  const succeeded = await checkBoostGiveaway(id);
  if (giveaway.ended) {
    stopBoostGiveawayMonitor(id);
    return;
  }

  const previousDelay = boostGiveawayRetryDelays.get(id) || 30000;
  const nextDelay = succeeded ? 30000 : Math.min(previousDelay * 2, 15 * 60 * 1000);
  boostGiveawayRetryDelays.set(id, nextDelay);

  const timer = setTimeout(() => {
    boostGiveawayTimers.delete(id);
    pollBoostGiveaway(id).catch(error =>
      console.error(`Could not schedule boost check for giveaway ${id}:`, error)
    );
  }, nextDelay);
  timer.unref();
  boostGiveawayTimers.set(id, timer);
}

function scheduleBoostGiveaway(giveaway) {
  if (
    giveaway.ended ||
    !giveaway.boostGoal ||
    boostGiveawayTimers.has(giveaway.id) ||
    boostGiveawayChecks.has(giveaway.id)
  ) return;
  boostGiveawayRetryDelays.set(giveaway.id, 30000);
  pollBoostGiveaway(giveaway.id).catch(error =>
    console.error(`Could not start boost check for giveaway ${giveaway.id}:`, error)
  );
}

function scheduleGiveaway(giveaway) {
  const existing = giveawayTimers.get(giveaway.id);
  if (existing) clearTimeout(existing);

  const remaining = giveaway.endsAt - Date.now();
  const delay = Math.max(0, Math.min(remaining, 2147483647));
  const timer = setTimeout(() => {
    if (giveaway.endsAt > Date.now()) {
      scheduleGiveaway(giveaway);
    } else {
      finishGiveaway(giveaway.id).catch(error =>
        console.error("Could not finish giveaway:", error)
      );
    }
  }, delay);
  giveawayTimers.set(giveaway.id, timer);
}

async function finishGiveaway(id) {
  const giveaway = giveawayData.giveaways[id];
  if (!giveaway || giveaway.ended) return;

  giveaway.ended = true;
  giveaway.winnerIds = [];
  const pool = [...new Set(giveaway.participants)];
  while (giveaway.winnerIds.length < Math.min(giveaway.winnerCount, pool.length)) {
    const index = Math.floor(Math.random() * pool.length);
    giveaway.winnerIds.push(pool.splice(index, 1)[0]);
  }

  await saveGiveawayData();
  giveawayTimers.delete(id);
  await updateGiveawayMessage(giveaway, true);

  const message = await getGiveawayMessage(giveaway);
  if (!message) return;

  const winnerText = giveaway.winnerIds.length
    ? giveaway.winnerIds.map(userId => `<@${userId}>`).join(", ")
    : "Nobody";
  await message.channel
    .send(
      `🎉 Giveaway ended for **${giveaway.prize}**! Winner${
        giveaway.winnerIds.length === 1 ? "" : "s"
      }: ${winnerText}` +
        (giveaway.winnerIds.length ? "\nWinners: please DM the server owners to claim your prize." : "")
    )
    .catch(error => console.error("Could not announce giveaway:", error));

  await Promise.all(
    giveaway.winnerIds.map(async userId => {
      const user = await client.users.fetch(userId).catch(() => null);
      if (user) {
        await user.send(
          `🎉 You won the giveaway for **${giveaway.prize}**! Please DM the server owners to claim your prize.`
        ).catch(() => {});
      }
    })
  );
}

async function restoreGiveaways() {
  await Promise.all(
    Object.values(giveawayData.giveaways).map(async giveaway => {
      giveaway.participants = [...new Set(giveaway.participants || [])];
      giveaway.winnerIds = giveaway.winnerIds || [];
      if (giveaway.boostGoal) {
        await updateBoostGiveawayMessage(giveaway, giveaway.ended);
      } else {
        await updateGiveawayMessage(giveaway, giveaway.ended);
      }
      if (giveaway.ended) return;
      if (giveaway.boostGoal) {
        scheduleBoostGiveaway(giveaway);
        return;
      }
      if (giveaway.endsAt <= Date.now()) {
        await finishGiveaway(giveaway.id);
      } else {
        scheduleGiveaway(giveaway);
      }
    })
  );
}

async function startGiveaway(e, args) {
  if (!e.guild || !e.member.permissions.has("MANAGE_GUILD")) {
    await e.channel.send("Only members with Manage Server can start giveaways.");
    return;
  }

  if (args.length < 5 || args[0].toLowerCase() !== "start") {
    await e.channel.send(
      "Usage: `!giveaway start <duration> <winners> <prize> <invites>` (example: `!giveaway start 2h 1 Nitro 2`)"
    );
    return;
  }

  const duration = parseDuration(args[1]);
  const winnerCount = Number(args[2]);
  const requiredInvites = Number(args[args.length - 1]);
  const prize = args.slice(3, -1).join(" ").trim();

  if (
    !duration ||
    !Number.isInteger(winnerCount) ||
    winnerCount < 1 ||
    winnerCount > 50 ||
    !Number.isInteger(requiredInvites) ||
    requiredInvites < 0 ||
    !prize
  ) {
    await e.channel.send(
      "Invalid giveaway options. Use a duration like `30m`, a whole-number winner count, a prize, and a non-negative invite requirement."
    );
    return;
  }

  const id = generateGiveawayId();
  const giveaway = {
    id,
    guildId: e.guild.id,
    channelId: e.channel.id,
    messageId: null,
    prize,
    winnerCount,
    requiredInvites,
    endsAt: Date.now() + duration,
    participants: [],
    winnerIds: [],
    ended: false
  };

  const message = await e.channel.send({
    embeds: [giveawayEmbed(giveaway)],
    components: giveawayComponents(giveaway)
  });
  giveaway.messageId = message.id;
  giveawayData.giveaways[id] = giveaway;
  await saveGiveawayData();
  scheduleGiveaway(giveaway);
}

async function startBoostGiveaway(e, args) {
  if (!e.guild || !e.member.permissions.has("MANAGE_GUILD")) {
    await e.channel.send("Only members with Manage Server can start giveaways.");
    return;
  }

  if (args.length < 3 || args[0].toLowerCase() !== "start") {
    await e.channel.send(
      "Usage: `!boostgiveaway start <winners> <prize>` (example: `!boostgiveaway start 1 Nitro`)"
    );
    return;
  }

  const winnerCount = Number(args[1]);
  const prize = args.slice(2).join(" ").trim();
  if (!Number.isInteger(winnerCount) || winnerCount < 1 || winnerCount > 50 || !prize) {
    await e.channel.send("Choose 1–50 winners and provide a prize name.");
    return;
  }

  await e.guild.fetch();
  if (e.guild.premiumSubscriptionCount >= 15) {
    await e.channel.send("This giveaway cannot start because the server has already reached 15 boosts.");
    return;
  }
  if (!getBoosterRole(e.guild)) {
    await e.channel.send('I could not find the **Server Booster** role in this server.');
    return;
  }

  const existing = Object.values(giveawayData.giveaways).find(
    giveaway => giveaway.guildId === e.guild.id && giveaway.boostGoal && !giveaway.ended
  );
  if (existing) {
    await e.channel.send("There is already an active booster giveaway in this server.");
    return;
  }

  const id = generateGiveawayId();
  const giveaway = {
    id,
    guildId: e.guild.id,
    channelId: e.channel.id,
    messageId: null,
    prize,
    winnerCount,
    boostGoal: 15,
    participants: [],
    winnerIds: [],
    ended: false
  };
  const message = await e.channel.send({
    embeds: [boostGiveawayEmbed(giveaway, e.guild.premiumSubscriptionCount)],
    components: boostGiveawayComponents(giveaway)
  });
  giveaway.messageId = message.id;
  giveawayData.giveaways[id] = giveaway;
  try {
    await saveGiveawayData();
  } catch (error) {
    delete giveawayData.giveaways[id];
    await message.delete().catch(deleteError =>
      console.error("Could not remove unsaved booster giveaway message:", deleteError)
    );
    throw error;
  }
  scheduleBoostGiveaway(giveaway);
}

async function handleGiveawayButton(interaction, action, giveawayId) {
  if (!interaction || !interaction.isButton()) return;

  await interaction.deferReply({ ephemeral: true }).catch(() => {});

  const giveaway = giveawayData.giveaways[giveawayId];
  if (!giveaway || giveaway.ended) {
    await interaction.editReply({ content: "This giveaway has ended." }).catch(() => {});
    return;
  }

  const guild = interaction.guild;
  const user = interaction.user;
  const inviteCount = await countActiveInvitees(guild, user.id);

  if (action === "leave") {
    giveaway.participants = giveaway.participants.filter(id => id !== user.id);
    await saveGiveawayData();
    await interaction.editReply({ content: `You left the giveaway for **${giveaway.prize}**.` }).catch(() => {});
    await updateGiveawayMessage(giveaway);
    return;
  }

  if (inviteCount < giveaway.requiredInvites) {
    await interaction.editReply({
      content: `You do not have enough invites for **${giveaway.prize}**. You have ${inviteCount}; you need ${giveaway.requiredInvites}.`
    }).catch(() => {});
    return;
  }

  if (!giveaway.participants.includes(user.id)) {
    giveaway.participants.push(user.id);
    await saveGiveawayData();
    await interaction.editReply({
      content: `You have ${inviteCount} invite${inviteCount === 1 ? "" : "s"} and qualify for **${giveaway.prize}**. You are entered!`
    }).catch(() => {});
    await updateGiveawayMessage(giveaway);
    return;
  }

  await interaction.editReply({ content: `You are already entered in **${giveaway.prize}**.` }).catch(() => {});
}

async function handleBoostGiveawayButton(interaction, action, giveawayId) {
  await interaction.deferReply({ ephemeral: true });
  const giveaway = giveawayData.giveaways[giveawayId];
  if (
    !giveaway ||
    giveaway.ended ||
    !giveaway.boostGoal ||
    !interaction.guild ||
    interaction.guild.id !== giveaway.guildId
  ) {
    await interaction.editReply({ content: "This booster giveaway has ended." });
    return;
  }

  const userId = interaction.user.id;
  if (action === "leave") {
    giveaway.participants = giveaway.participants.filter(id => id !== userId);
    try {
      await saveGiveawayData();
    } catch (error) {
      if (!giveaway.participants.includes(userId)) giveaway.participants.push(userId);
      throw error;
    }
    await interaction.editReply({ content: `You left the giveaway for **${giveaway.prize}**.` });
    await updateBoostGiveawayMessage(giveaway);
    return;
  }

  const boosterRole = getBoosterRole(interaction.guild);
  let member = interaction.guild.members.cache.get(userId);
  if (!member) {
    try {
      member = await interaction.guild.members.fetch(userId);
    } catch (error) {
      console.error(`Could not verify booster role for ${userId}:`, error);
      await interaction.editReply({ content: "I couldn't verify your booster role. Please try again." });
      return;
    }
  }
  if (!boosterRole || !member.roles.cache.has(boosterRole.id)) {
    await interaction.editReply({
      content: "Only members with the **Server Booster** role can enter this giveaway."
    });
    return;
  }

  if (giveaway.participants.includes(userId)) {
    await interaction.editReply({ content: `You are already entered in **${giveaway.prize}**.` });
    return;
  }

  giveaway.participants.push(userId);
  try {
    await saveGiveawayData();
  } catch (error) {
    giveaway.participants = giveaway.participants.filter(id => id !== userId);
    throw error;
  }
  await interaction.editReply({ content: `You entered the booster giveaway for **${giveaway.prize}**!` });
  await updateBoostGiveawayMessage(giveaway);
}

async function addManualInvites(e, args) {
  if (!e.guild || !e.member.permissions.has("MANAGE_GUILD")) {
    await e.channel.send("Only members with Manage Server can add invites.");
    return;
  }

  const amount = Number(args[0]);
  let target = e.mentions.users.first();
  if (!target && args[1]) {
    const member = e.guild.members.cache.find(
      candidate =>
        candidate.id === args[1] ||
        candidate.user.username.toLowerCase() === args[1].toLowerCase() ||
        candidate.displayName.toLowerCase() === args[1].toLowerCase()
    );
    target = member && member.user;
  }

  if (!Number.isInteger(amount) || amount < 1 || !target) {
    await e.channel.send("Usage: `!add invite <number> <user>`");
    return;
  }

  const state = getInviteState(e.guild.id);
  state.manualInvites[target.id] = Number(state.manualInvites[target.id] || 0) + amount;
  await saveInviteTracker();
  await e.channel.send(
    `Added **${amount}** invite${amount === 1 ? "" : "s"} to ${target}. Their giveaway invite total is now **${await countActiveInvitees(
      e.guild,
      target.id
    )}**.`
  );
}

async function resolveInviteTarget(guild, rawTarget, mentionedUser) {
  if (mentionedUser) {
    const cachedMember = guild.members.cache.get(mentionedUser.id);
    if (cachedMember) return cachedMember;
    try {
      return await guild.members.fetch(mentionedUser.id);
    } catch (error) {
      if (error && (error.code === 10007 || error.status === 404)) return null;
      throw error;
    }
  }

  const targetId = rawTarget.replace(/[<@!>]/g, "");
  const cachedMember = guild.members.cache.get(targetId) || guild.members.cache.find(
    candidate =>
      candidate.user.username.toLowerCase() === rawTarget.toLowerCase() ||
      candidate.displayName.toLowerCase() === rawTarget.toLowerCase()
  );
  if (cachedMember) return cachedMember;

  if (/^\d{17,20}$/.test(targetId)) {
    try {
      return await guild.members.fetch(targetId);
    } catch (error) {
      if (error && (error.code === 10007 || error.status === 404)) return null;
      throw error;
    }
  }
  return null;
}

async function getInviteStats(e, args) {
  if (!e.guild) return;

  const state = getInviteState(e.guild.id);
  const stats = createInviteStats(state);
  
  const rows = Object.entries(stats.activeCounts)
    .map(([inviterId, active]) => ({
      id: inviterId,
      active,
      lifetime: stats.lifetotals[inviterId] || 0,
      manual: stats.manual[inviterId] || 0
    }))
    .map(item => ({
      ...item,
      total: item.active + item.manual
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);

  const embed = new EmbedBuilder()
    .setTitle("📈 Server Invite Statistics")
    .setDescription("Detailed breakdown of all invites on this server")
    .setColor("#5865F2")
    .setFields(
      {
        name: "Top Inviters",
        value: rows.length
          ? rows
              .map((r, idx) => {
                const member = e.guild.members.cache.get(r.id);
                const name = member ? member.user.username : `<@${r.id}>`;
                return `${idx + 1}. **${name}** - ${r.total} (${r.active} active + ${r.manual} manual)`;
              })
              .join("\n")
          : "No invites tracked yet",
        inline: false
      },
      {
        name: "Statistics",
        value: `Total Active Members Tracked: **${Object.values(stats.activeCounts).reduce((a, b) => a + b, 0)}**\n` +
               `Total Lifetime Invites: **${Object.values(stats.lifetotals).reduce((a, b) => a + b, 0)}**\n` +
               `Total Manual Credits: **${Object.values(stats.manual).reduce((a, b) => a + b, 0)}**`,
        inline: false
      }
    )
    .setFooter({ text: "Use !check invites <user> for detailed stats" });

  await e.channel.send({ embeds: [embed] });
}

async function checkInvites(e, args) {
  if (!e.guild) return;

  const target = await resolveInviteTarget(
    e.guild,
    args[0] || "",
    e.mentions.users.first()
  );
  if (!target) {
    await e.channel.send("Usage: `!check invites <user>`");
    return;
  }

  const state = getInviteState(e.guild.id);
  const needsTotalsMigration = !state.inviteTotals;
  ensureInviteTotals(state, state.invites);
  if (needsTotalsMigration) await saveInviteTracker();
  
  const activeTotal = await countActiveInvitees(e.guild, target.id);
  const manual = Number(state.manualInvites[target.id] || 0);
  const activeTracked = activeTotal - manual;
  const lifetimeTracked = Number(state.inviteTotals[target.id] || 0);
  const total = lifetimeTracked + manual;

  const embed = new EmbedBuilder()
    .setTitle(`📊 ${target.user.username}'s Invite Statistics`)
    .setThumbnail(target.user.displayAvatarURL())
    .addFields(
      { name: "Total Invites", value: `\`${total}\``, inline: true },
      { name: "Active Members", value: `\`${activeTracked}\``, inline: true },
      { name: "Manual Credits", value: `\`${manual}\``, inline: true },
      { name: "Lifetime Joins", value: `\`${lifetimeTracked}\``, inline: true },
      { name: "Currently Active", value: `\`${activeTracked}/${lifetimeTracked}\` (${lifetimeTracked > 0 ? ((activeTracked / lifetimeTracked) * 100).toFixed(1) : '0'}%)`, inline: true },
      { name: "Progress to Next Tier", value: total >= 15 ? "🏆 **Platinum** (15+ invites)" : total >= 10 ? "🥇 **Gold** (10+ invites)" : total >= 5 ? "🥈 **Silver** (5+ invites)" : total >= 2 ? "🥉 **Bronze** (2+ invites)" : "👤 **Starter** (0-1 invites)", inline: false }
    )
    .setColor(total >= 15 ? "#FFD700" : total >= 10 ? "#C0C0C0" : "#FF6B6B")
    .setFooter({ text: "Active = Members still in the server who joined via this invite" });
  
  await e.channel.send({ embeds: [embed] });
}

async function removeManualInvites(e, args) {
  if (!e.guild || !e.member.permissions.has("MANAGE_GUILD")) {
    await e.channel.send("Only members with Manage Server can remove invites.");
    return;
  }

  const amount = Number(args[0]);
  const target = await resolveInviteTarget(
    e.guild,
    args[1] || "",
    e.mentions.users.first()
  );
  if (!Number.isInteger(amount) || amount < 1 || !target) {
    await e.channel.send("Usage: `!remove invites <number> <user>`");
    return;
  }

  const state = getInviteState(e.guild.id);
  const currentManual = Number(state.manualInvites[target.id] || 0);
  if (amount > currentManual) {
    await e.channel.send(
      `${target} has only **${currentManual}** manually granted invite${currentManual === 1 ? "" : "s"}.`
    );
    return;
  }

  const remaining = currentManual - amount;
  if (remaining === 0) {
    delete state.manualInvites[target.id];
  } else {
    state.manualInvites[target.id] = remaining;
  }
  await saveInviteTracker();
  await e.channel.send(
    `Removed **${amount}** manually granted invite${amount === 1 ? "" : "s"} from ${target}. ` +
      `Their total is now **${await countActiveInvitees(e.guild, target.id)}**.`
  );
}

async function nitrogenerator(e, t, templateName = "testingboost.html") {
  await rendererReady;
  const a = formatAMPM(new Date());
  const n = formatAMPM(new Date(Date.now() - 6e4));
  let o = await fs.readFileSync(`${__dirname}/${templateName}`, "utf8");

  let targetUser = e.mentions.users.first() || e.author;
  const rawTarget = t[0] || "";

  if (!e.mentions.users.first() && rawTarget && e.guild) {
    const member = e.guild.members.cache.find(
      m =>
        m.user.username.toLowerCase() === rawTarget.toLowerCase() ||
        m.displayName.toLowerCase() === rawTarget.toLowerCase() ||
        `${m.user.username}#${m.user.discriminator}`.toLowerCase() === rawTarget.toLowerCase()
    );
    if (member) {
      targetUser = member.user;
    }
  }

  const mentionToken = `<@${targetUser.id}>`;
  const mentionTokenAlt = `<@!${targetUser.id}>`;
  const filteredArgs = t.filter(
    arg =>
      arg !== mentionToken &&
      arg !== mentionTokenAlt &&
      arg.toLowerCase() !== rawTarget.toLowerCase()
  );
  const targetName = (e.guild && e.guild.members.cache.get(targetUser.id)?.displayName) || targetUser.username;
  const targetMessage = filteredArgs.length ? filteredArgs.join(" ") : "Thanks for the invite!";

  let renderHtml = o;
  renderHtml = renderHtml.replace(
    "FIRSTAUTHORURL",
    e.author.displayAvatarURL({ extension: "png", size: 256 })
  );
  renderHtml = renderHtml.replace("THEFIRSTAUTHOR", e.author.username);
  renderHtml = renderHtml.replace(
    "SECONDAUTHORURL",
    targetUser.displayAvatarURL({ extension: "png", size: 256 })
  );
  renderHtml = renderHtml.replace("THESECONDAUTHOR", targetName);
  renderHtml = renderHtml.replace("RESPONSETONITRO", targetMessage);
  renderHtml = renderHtml.replace("FIRSTAUTHORDATE", "Today at " + n);
  renderHtml = renderHtml.replace("SECONDAUTHORDATE", "Today at " + a);
  renderHtml = renderHtml.split("http://localhost:3000/font").join(`${rendererUrl}/font`);
  renderHtml = renderHtml
    .split("https://cdn.discordapp.com/attachments/782434583974248511/793316025244057630/nitroregular.png")
    .join(`${rendererUrl}/${templateName === "testing.html" ? "nitroclassic" : "nitroboost"}.png`);

  const { default: puppeteer } = await import("puppeteer");
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const renderId = randomUUID();
  renderSessions.set(renderId, renderHtml);
  let c;
  try {
    const page = await browser.newPage();
    await page.goto(`${rendererUrl}/render/${renderId}`, { waitUntil: "networkidle0" });
    await page.waitForSelector(".scrollerInner-2YIMLh");
    await page.evaluate(() =>
      Promise.all(
        Array.from(document.images).map(image =>
          image.complete
            ? Promise.resolve()
            : new Promise(resolve => {
                image.addEventListener("load", resolve, { once: true });
                image.addEventListener("error", resolve, { once: true });
              })
        )
      )
    );
    const messageList = await page.$(".scrollerInner-2YIMLh");
    c = await messageList.screenshot({ type: "png" });
  } finally {
    try {
      await browser.close();
    } finally {
      renderSessions.delete(renderId);
    }
  }

  const imgBuffer = Buffer.isBuffer(c) ? c : Buffer.from(c || []);
  if (!imgBuffer || imgBuffer.length === 0) {
    throw new Error("Puppeteer screenshot returned an empty image buffer.");
  }

  const attachment = new AttachmentBuilder(imgBuffer, { name: "NitroProof.png" });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`proof:yes:${e.author.id}`)
      .setLabel("Yes")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`proof:cancel:${e.author.id}`)
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Secondary)
  );
  await e.channel.send({ content: `${e.author}`, files: [attachment], components: [row] });
}

process.on("SIGINT", () => renderServer.close(() => process.exit(0)));
process.on("SIGTERM", () => renderServer.close(() => process.exit(0)));

function formatAMPM(e) {
  let t = e.getHours();
  const a = e.getMinutes();
  let n = t >= 12 ? "PM" : "AM";
  t = (t %= 12) || 12;
  return `${t}:${String(a).padStart(2, "0")} ${n}`;
}

const PANEL_TITLE = "Server Invites Checker";
const PANEL_FOOTER = "React with 🎟️ to check your invites";

async function handleInvitePanelReaction(reaction, user) {
  if (!reaction || !user || user.bot || reaction.emoji.name !== "🎟️") return;

  try {
    if (reaction.partial) await reaction.fetch();

    let panelMessage = reaction.message;
    if (panelMessage.partial) panelMessage = await panelMessage.fetch();

    const panelEmbed = panelMessage.embeds && panelMessage.embeds[0];
    if (
      !panelMessage.guild ||
      !panelEmbed ||
      panelEmbed.title !== PANEL_TITLE ||
      !panelEmbed.footer ||
      panelEmbed.footer.text !== PANEL_FOOTER
    ) {
      return;
    }

    const guild = panelMessage.guild;
    const channel = panelMessage.channel;
    const guildMember =
      guild.members.cache.get(user.id) ||
      (await guild.members.fetch(user.id).catch(() => null));
    if (!guildMember) return;

    const inviteCount = await countActiveInvitees(guild, user.id);

    const result = await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(`${user.tag}'s Invites`)
          .setDescription(`You currently have ${inviteCount} active invite${inviteCount === 1 ? "" : "s"}.`)
          .setColor("#43b581")
          .setFooter({ text: "React with ❌ to dismiss" })
      ]
    });

    await result.react("❌");
    const dismissFilter = (r, u) =>
      r.emoji.name === "❌" && !u.bot && r.message.id === result.id && u.id === user.id;
    const dismissCollector = result.createReactionCollector({ filter: dismissFilter });
    dismissCollector.on("collect", async () => {
      await result.delete().catch(() => {});
    });

    await reaction.users.remove(user.id).catch(() => {});
  } catch (error) {
    console.error("Invite panel reaction failed:", error);
  }
}

async function sendInvitePanel(e) {
  const state = getInviteState(e.guild.id);
  const stats = createInviteStats(state);
  
  const userInvites = await countActiveInvitees(e.guild, e.author.id);
  
  const panel = new EmbedBuilder()
    .setTitle("👥 Server Invites Checker")
    .setDescription(
      "Check your invites to earn rewards!\n\n" +
      "**🎯 Your Statistics:**\n" +
      `Active Members: **${userInvites}**\n\n` +
      "**📊 Reward Tiers:**\n" +
      "🥉 Bronze: 2 invites\n" +
      "🥈 Silver: 5 invites\n" +
      "🥇 Gold: 10 invites\n" +
      "🏆 Platinum: 15+ invites"
    )
    .setColor("#5865F2")
    .setFooter({ text: "React with 🎟️ to check your full invite stats" });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("invite_panel:check")
      .setLabel("Check My Invites")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("invite_panel:leaderboard")
      .setLabel("View Leaderboard")
      .setStyle(ButtonStyle.Secondary)
  );

  await e.channel.send({ embeds: [panel], components: [row] });
}

async function sendNitroRequestPanel(e) {
  const panel = new EmbedBuilder()
    .setTitle("Nitro request")
    .setDescription(
      "Choose a Nitro reward below to check your invite eligibility.\n\n" +
        "**Nitro Classic — 2 invites (1 month)**\n" +
        "**Nitro Booster — 4 invites (1 month)**\n" +
        "**Nitro Classic — 10 invites (1 year)**\n" +
        "**Nitro Booster — 15 invites (1 year)**"
    )
    .setColor("#5865F2")
    .setFooter({ text: "Select one reward to check your invites" });

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("nitro_panel:select")
      .setPlaceholder("Choose a Nitro reward")
      .addOptions(
        {
          label: "Nitro Classic — 1 month",
          description: "Requires 2 invites",
          value: "classic_month"
        },
        {
          label: "Nitro Booster — 1 month",
          description: "Requires 4 invites",
          value: "booster_month"
        },
        {
          label: "Nitro Classic — 1 year",
          description: "Requires 10 invites",
          value: "classic_year"
        },
        {
          label: "Nitro Booster — 1 year",
          description: "Requires 15 invites",
          value: "booster_year"
        }
      )
  );

  await e.channel.send({ embeds: [panel], components: [row] });
}

async function handleBan(interaction) {
  if (!interaction.memberPermissions?.has("BAN_MEMBERS")) {
    await interaction.reply({ content: "You need Ban Members permission.", ephemeral: true });
    return;
  }
  const user = interaction.options.getUser("user");
  const reason = interaction.options.getString("reason") || "No reason provided";
  
  try {
    await interaction.guild.members.ban(user, { reason });
    await moderation.banUser(interaction.guild, user.id, reason);
    await interaction.reply({ embeds: [moderation.createBanEmbed(user.id, reason)] });
  } catch (error) {
    await interaction.reply({ content: "Could not ban this user.", ephemeral: true });
    console.error("Ban error:", error);
  }
}

async function handleKick(interaction) {
  if (!interaction.memberPermissions?.has("KICK_MEMBERS")) {
    await interaction.reply({ content: "You need Kick Members permission.", ephemeral: true });
    return;
  }
  const user = interaction.options.getUser("user");
  const reason = interaction.options.getString("reason") || "No reason provided";
  
  try {
    const member = await interaction.guild.members.fetch(user.id);
    await member.kick(reason);
    await interaction.reply({ embeds: [moderation.createKickEmbed(user.id, reason)] });
  } catch (error) {
    await interaction.reply({ content: "Could not kick this user.", ephemeral: true });
    console.error("Kick error:", error);
  }
}

async function handleWarn(interaction) {
  if (!interaction.memberPermissions?.has("MODERATE_MEMBERS")) {
    await interaction.reply({ content: "You need Moderate Members permission.", ephemeral: true });
    return;
  }
  const user = interaction.options.getUser("user");
  const reason = interaction.options.getString("reason");
  
  try {
    const warnCount = await moderation.warnUser(interaction.guild, user.id, reason, interaction.user.id);
    await interaction.reply({ embeds: [moderation.createWarnEmbed(user.id, warnCount, reason)] });
    
    if (warnCount >= 3) {
      try {
        const member = await interaction.guild.members.fetch(user.id);
        await member.timeout(86400000, "Automatic timeout: 3 warns");
      } catch (e) {
        console.error("Could not auto-timeout:", e);
      }
    }
  } catch (error) {
    console.error("Warn error:", error);
  }
}

async function handleTimeout(interaction) {
  if (!interaction.memberPermissions?.has("MODERATE_MEMBERS")) {
    await interaction.reply({ content: "You need Moderate Members permission.", ephemeral: true });
    return;
  }
  const user = interaction.options.getUser("user");
  const duration = interaction.options.getString("duration");
  const reason = interaction.options.getString("reason") || "No reason provided";
  
  const durationMs = parseDuration(duration);
  if (!durationMs) {
    await interaction.reply({ content: "Invalid duration. Use: 1h, 30m, 1d, etc.", ephemeral: true });
    return;
  }
  
  try {
    const member = await interaction.guild.members.fetch(user.id);
    await member.timeout(durationMs, reason);
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("⏱️ User Timed Out")
          .setDescription(`<@${user.id}> has been timed out for ${duration}.\n**Reason:** ${reason}`)
          .setColor("#FF9900")
          .setTimestamp()
      ]
    });
  } catch (error) {
    await interaction.reply({ content: "Could not timeout this user.", ephemeral: true });
    console.error("Timeout error:", error);
  }
}

async function handleWarns(interaction) {
  const user = interaction.options.getUser("user");
  const warns = await moderation.getWarns(interaction.guild, user.id);
  
  const embed = new EmbedBuilder()
    .setTitle(`⚠️ Warns for ${user.tag}`)
    .setThumbnail(user.displayAvatarURL())
    .setColor(warns.length > 0 ? "#FF6600" : "#43b581");
  
  if (warns.length === 0) {
    embed.setDescription("This user has no warns.");
  } else {
    const warnList = warns.map((w, i) => `${i + 1}. ${w.reason} (by <@${w.moderatorId}>)`).join("\n");
    embed.addFields({ name: `Total Warns: ${warns.length}`, value: warnList });
  }
  
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleClearWarns(interaction) {
  if (!interaction.memberPermissions?.has("MANAGE_GUILD")) {
    await interaction.reply({ content: "You need Manage Server permission.", ephemeral: true });
    return;
  }
  const user = interaction.options.getUser("user");
  await moderation.clearWarns(interaction.guild, user.id);
  await interaction.reply({ content: `Cleared all warns for <@${user.id}>.`, ephemeral: true });
}

async function handleClear(interaction) {
  if (!interaction.memberPermissions?.has("MANAGE_MESSAGES")) {
    await interaction.reply({ content: "You need Manage Messages permission.", ephemeral: true });
    return;
  }
  const amount = interaction.options.getInteger("amount");
  
  try {
    await interaction.channel.bulkDelete(amount);
    await interaction.reply({ content: `✅ Cleared ${amount} message${amount === 1 ? "" : "s"}.`, ephemeral: true });
  } catch (error) {
    await interaction.reply({ content: "Could not clear messages.", ephemeral: true });
  }
}

async function handleListGiveaways(interaction) {
  const giveaways = Object.values(giveawayData.giveaways).filter(g => g.guildId === interaction.guild.id && !g.ended);
  
  if (giveaways.length === 0) {
    await interaction.reply({ content: "No active giveaways.", ephemeral: true });
    return;
  }
  
  const list = giveaways.map(g => `**${g.prize}** - ID: \`${g.id}\` (${g.participants.length} entries)`).join("\n");
  
  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle("🎉 Active Giveaways")
        .setDescription(list)
        .setColor("#5865F2")
    ],
    ephemeral: true
  });
}

async function handleCancelGiveaway(interaction) {
  if (!interaction.memberPermissions?.has("MANAGE_GUILD")) {
    await interaction.reply({ content: "You need Manage Server permission.", ephemeral: true });
    return;
  }
  
  const giveawayId = interaction.options.getString("giveaway-id");
  const giveaway = giveawayData.giveaways[giveawayId];
  
  if (!giveaway || giveaway.guildId !== interaction.guild.id) {
    await interaction.reply({ content: "Giveaway not found.", ephemeral: true });
    return;
  }
  
  giveaway.ended = true;
  giveaway.winnerIds = [];
  await saveGiveawayData();
  giveawayTimers.delete(giveawayId);
  
  await interaction.reply({ content: `Cancelled giveaway for **${giveaway.prize}**.`, ephemeral: true });
}

async function handleRerollGiveaway(interaction) {
  if (!interaction.memberPermissions?.has("MANAGE_GUILD")) {
    await interaction.reply({ content: "You need Manage Server permission.", ephemeral: true });
    return;
  }
  
  const giveawayId = interaction.options.getString("giveaway-id");
  const giveaway = giveawayData.giveaways[giveawayId];
  
  if (!giveaway || giveaway.guildId !== interaction.guild.id) {
    await interaction.reply({ content: "Giveaway not found.", ephemeral: true });
    return;
  }
  
  const pool = [...new Set(giveaway.participants)];
  giveaway.winnerIds = [];
  while (giveaway.winnerIds.length < Math.min(giveaway.winnerCount, pool.length)) {
    const index = Math.floor(Math.random() * pool.length);
    giveaway.winnerIds.push(pool.splice(index, 1)[0]);
  }
  
  await saveGiveawayData();
  await updateGiveawayMessage(giveaway, true);
  
  const winnerText = giveaway.winnerIds.length
    ? giveaway.winnerIds.map(id => `<@${id}>`).join(", ")
    : "Nobody";

  const claimInstructions = giveaway.winnerIds.length
    ? "\nWinners: please DM the server owners to claim your prize."
    : "";
  await interaction.reply({
    content: `🎉 **Rerolled!** New winners: ${winnerText}${claimInstructions}`,
    ephemeral: true
  });
  if (giveaway.winnerIds.length) {
    const message = await getGiveawayMessage(giveaway);
    if (message) {
      await message.channel.send(
        `🎉 **Giveaway rerolled!** New winners for **${giveaway.prize}**: ${winnerText}\n` +
          "Winners: please DM the server owners to claim your prize."
      );
    }
    await Promise.all(
      giveaway.winnerIds.map(async userId => {
        const user = await client.users.fetch(userId).catch(() => null);
        if (user) {
          await user.send(
            `🎉 You won the reroll for **${giveaway.prize}**! Please DM the server owners to claim your prize.`
          ).catch(() => {});
        }
      })
    );
  }
}

async function registerSlashCommands() {
  if (!client.user) return;

  const rest = new REST({ version: "10" }).setToken(finalConfig.token);
  const guildId = finalConfig.guildId;
  const route = guildId
    ? Routes.applicationGuildCommands(client.user.id, guildId)
    : Routes.applicationCommands(client.user.id);

  try {
    await rest.put(route, { body: PANEL_COMMANDS.map(command => ({
      ...command,
      type: 1
    })) });
    console.log("Slash commands registered.");
  } catch (error) {
    console.error("Could not register slash commands:", error);
  }
}

client.on("interactionCreate", async interaction => {
  if (interaction.isChatInputCommand()) {
    const commandName = interaction.commandName.toLowerCase();
    try {
      if (commandName === "panel") {
        await sendInvitePanel({ channel: interaction.channel, guild: interaction.guild, member: interaction.member });
        await interaction.reply({ content: "Invite panel sent.", ephemeral: true });
        return;
      }
      if (commandName === "panel-2") {
        await sendNitroRequestPanel({ channel: interaction.channel, guild: interaction.guild, member: interaction.member });
        await interaction.reply({ content: "Nitro panel sent.", ephemeral: true });
        return;
      }
      if (commandName === "leaderboard") {
        await sendLeaderboard({ channel: interaction.channel, guild: interaction.guild, member: interaction.member });
        await interaction.reply({ content: "Leaderboard sent.", ephemeral: true });
        return;
      }
      if (commandName === "send") {
        if (!interaction.memberPermissions?.has("MANAGE_GUILD")) {
          await interaction.reply({
            content: "Only members with Manage Server can trigger the leaderboard command.",
            ephemeral: true
          });
          return;
        }

        await sendDailyLeaderboardCommand();
        await interaction.reply({
          content: `Sent \`!leaderboard\` to <#${DAILY_LEADERBOARD_COMMAND_CHANNEL_ID}>.`,
          ephemeral: true
        });
        return;
      }
      if (commandName === "dock") {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        try {
          const dockChannel = await ensureDockChannel(interaction.guild, interaction.channel);
          if (!dockChannel) {
            await interaction.editReply({ content: "I could not create the dock channel. I may be missing permission to create/manage channels." });
            return;
          }

          await interaction.editReply({
            content: `Dock channel ready: ${dockChannel}`
          });
          return;
        } catch (error) {
          console.error("Dock command failed:", error);
          await interaction.editReply({ content: "I need the Manage Channels permission to create the dock channel." }).catch(() => {});
          return;
        }
      }
      if (commandName === "invite-stats") {
        await getInviteStats({ channel: interaction.channel, guild: interaction.guild, member: interaction.member }, []);
        await interaction.reply({ content: "Invite stats sent.", ephemeral: true });
        return;
      }
      if (commandName === "check-invites") {
        const targetUser = interaction.options.getUser("user");
        await checkInvites({ channel: interaction.channel, guild: interaction.guild, member: interaction.member, mentions: { users: { first: () => targetUser } } }, []);
        await interaction.reply({ content: "Invite check sent.", ephemeral: true });
        return;
      }
      if (commandName === "add-invite") {
        const amount = interaction.options.getInteger("amount");
        const targetUser = interaction.options.getUser("user");
        await addManualInvites({ channel: interaction.channel, guild: interaction.guild, member: interaction.member, mentions: { users: { first: () => targetUser } } }, [String(amount), targetUser.id]);
        await interaction.reply({ content: "Invite added.", ephemeral: true });
        return;
      }
      if (commandName === "remove-invite") {
        const amount = interaction.options.getInteger("amount");
        const targetUser = interaction.options.getUser("user");
        await removeManualInvites({ channel: interaction.channel, guild: interaction.guild, member: interaction.member, mentions: { users: { first: () => targetUser } } }, [String(amount), targetUser.id]);
        await interaction.reply({ content: "Invite removed.", ephemeral: true });
        return;
      }
      if (commandName === "ban") {
        await handleBan(interaction);
        return;
      }
      if (commandName === "kick") {
        await handleKick(interaction);
        return;
      }
      if (commandName === "warn") {
        await handleWarn(interaction);
        return;
      }
      if (commandName === "timeout") {
        await handleTimeout(interaction);
        return;
      }
      if (commandName === "warns") {
        await handleWarns(interaction);
        return;
      }
      if (commandName === "clear-warns") {
        await handleClearWarns(interaction);
        return;
      }
      if (commandName === "clear") {
        await handleClear(interaction);
        return;
      }
      if (commandName === "giveaway") {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === "start") {
          const duration = interaction.options.getString("duration");
          const winners = interaction.options.getInteger("winners");
          const prize = interaction.options.getString("prize");
          const invites = interaction.options.getInteger("invites");
          await interaction.reply({ content: "Starting giveaway...", ephemeral: true });
          await startGiveaway(
            {
              guild: interaction.guild,
              member: interaction.member,
              channel: interaction.channel,
              author: interaction.user
            },
            ["start", duration, String(winners), prize, String(invites)]
          );
          return;
        }
        if (subcommand === "cancel") {
          await handleCancelGiveaway(interaction);
          return;
        }
        if (subcommand === "reroll") {
          await handleRerollGiveaway(interaction);
          return;
        }
        if (subcommand === "list") {
          await handleListGiveaways(interaction);
          return;
        }
      }
    } catch (error) {
      console.error("Slash command failed:", error);
      await interaction.reply({ content: "This command failed.", ephemeral: true }).catch(() => {});
    }
    return;
  }

  if (interaction.isStringSelectMenu() && interaction.customId === "nitro_panel:select") {
    try {
      await interaction.deferReply({ ephemeral: true });
      const reward = NITRO_REWARDS[interaction.values[0]];
      if (!reward || !interaction.guild) {
        await interaction.editReply({ content: "I couldn't identify that Nitro reward. Please select it again." });
        return;
      }

      const inviteCount = await countActiveInvitees(interaction.guild, interaction.user.id);
      const qualifies = inviteCount >= reward.invites;
      const result = qualifies
        ? `You have **${inviteCount} invites**, allowing you to qualify for **${reward.name}**. ` +
          "It will take around 7 days for it to be delivered. If you would like it instantly, " +
          "please invite 2 more people and then DM the owners."
        : `You don't have enough invites for **${reward.name} (${reward.duration})** yet. ` +
          `This reward requires **${reward.invites} invites**; you currently have **${inviteCount}**.`;

      try {
        await interaction.user.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${reward.name} reward check`)
              .setDescription(result)
              .setColor(qualifies ? "#43b581" : "#ff5555")
          ]
        });
        await interaction.editReply({ content: "I sent your reward eligibility result in DMs." });
      } catch (error) {
        if (error && error.code !== 50007) {
          console.error(`Could not DM Nitro reward result to ${interaction.user.id}:`, error);
        }
        await interaction.editReply({
          content: `I couldn't DM you. Your result: ${result}`
        });
      }
    } catch (error) {
      console.error("Nitro reward selection failed:", error);
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: "I couldn't check your reward eligibility. Please try again." }).catch(() => {});
      } else {
        await interaction.reply({ content: "I couldn't check your reward eligibility. Please try again.", ephemeral: true }).catch(() => {});
      }
    }
    return;
  }

  if (!interaction.isButton()) return;

  if (interaction.customId.startsWith("proof:")) {
    const [, action, requesterId] = interaction.customId.split(":");
    if (interaction.user.id !== requesterId) {
      await interaction.reply({
        content: "Only the person who generated this proof can choose what to do with it.",
        ephemeral: true
      });
      return;
    }

    if (action === "cancel") {
      await interaction.update({ components: [] }).catch(error =>
        console.error("Could not remove generated-proof buttons:", error)
      );
      return;
    }

    if (action !== "yes") return;

    await interaction.deferReply({ ephemeral: true });
    try {
      const sourceAttachment = interaction.message.attachments.first();
      if (!sourceAttachment) {
        await interaction.editReply("I couldn't find the generated image on this message.");
        return;
      }

      const destination = await client.channels.fetch(GENERATED_PROOF_CHANNEL_ID);
      if (!destination || !destination.isTextBased() || typeof destination.send !== "function") {
        throw new Error(`Proof destination ${GENERATED_PROOF_CHANNEL_ID} is unavailable or not text-based.`);
      }

      await destination.send({
        files: [{
          attachment: sourceAttachment.url,
          name: sourceAttachment.name || "NitroProof.png"
        }]
      });
      await interaction.message.edit({ components: [] }).catch(error =>
        console.error("Proof was sent, but its buttons could not be removed:", error)
      );
      await interaction.editReply("The image was sent to the proof channel.");
    } catch (error) {
      console.error("Could not forward generated proof:", error);
      await interaction.editReply("I couldn't send the image to the proof channel. Please try again.");
    }
    return;
  }

  if (interaction.customId.startsWith("giveaway:")) {
    const [type, action, giveawayId] = interaction.customId.split(":");
    if (type === "giveaway") {
      await handleGiveawayButton(interaction, action, giveawayId);
    }
    return;
  }
  if (interaction.customId.startsWith("boostgiveaway:")) {
    const [, action, giveawayId] = interaction.customId.split(":");
    await handleBoostGiveawayButton(interaction, action, giveawayId).catch(error =>
      {
        console.error("Booster giveaway button failed:", error);
        interaction.editReply({ content: "I couldn't save your giveaway entry. Please try again." }).catch(() => {});
      }
    );
    return;
  }

  if (interaction.customId === "invite_panel:check") {
    try {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});

      const guildMember =
        interaction.guild.members.cache.get(interaction.user.id) ||
        (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));
      if (!guildMember) return;

      const inviteCount = await countActiveInvitees(interaction.guild, interaction.user.id);

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${interaction.user.tag}'s Invites`)
            .setDescription(`You currently have ${inviteCount} active invite${inviteCount === 1 ? "" : "s"}.`)
            .setColor("#43b581")
        ]
      });
    } catch (error) {
      console.error("Invite panel button failed:", error);
    }
    return;
  }

  if (interaction.customId === "invite_panel:leaderboard") {
    try {
      await interaction.deferReply({ ephemeral: true });
      await sendLeaderboard({ channel: interaction.channel, guild: interaction.guild, member: interaction.member });
      await interaction.editReply({ content: "Leaderboard sent to the channel." });
    } catch (error) {
      console.error("Leaderboard button failed:", error);
      await interaction.editReply({ content: "I couldn't show the leaderboard." }).catch(() => {});
    }
    return;
  }

  if (interaction.customId === "nitro_panel:claim") {
    try {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});

      const guildMember =
        interaction.guild.members.cache.get(interaction.user.id) ||
        (await interaction.guild.members.fetch(interaction.user.id).catch(() => null));
      if (!guildMember) return;

      const inviteCount = await countActiveInvitees(interaction.guild, interaction.user.id);
      const message = buildNitroClaimMessage(interaction.user, inviteCount);

      await interaction.user.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("Nitro")
            .setDescription(message)
            .setColor(inviteCount >= 2 ? "#43b581" : "#ff5555")
        ]
      });
      await interaction.editReply({ content: "I sent the Nitro status in your DMs." }).catch(() => {});
    } catch (error) {
      console.error("Nitro claim button failed:", error);
    }
    return;
  }
});

client.on("messageReactionAdd", handleInvitePanelReaction);
client.on("messageReactionAdd", async (reaction, user) => {
  if (!reaction || !user || user.bot || reaction.emoji.name !== "🎟️") return;
  try {
    if (reaction.partial) await reaction.fetch();
    let panelMessage = reaction.message;
    if (panelMessage.partial) panelMessage = await panelMessage.fetch();

    const panelEmbed = panelMessage.embeds && panelMessage.embeds[0];
    if (
      !panelMessage.guild ||
      !panelEmbed ||
      panelEmbed.title !== "Nitro request" ||
      !panelEmbed.footer ||
      panelEmbed.footer.text !== "Click to claim"
    ) {
      return;
    }

    const guildMember =
      panelMessage.guild.members.cache.get(user.id) ||
      (await panelMessage.guild.members.fetch(user.id).catch(() => null));
    if (!guildMember) return;

    const inviteCount = await countActiveInvitees(panelMessage.guild, user.id);
    const message =
      inviteCount >= 2
        ? `Hello ${user}, your Nitro is on the way. Because there is a lot of demand, the owners will manually send your Nitro link as soon as possible.`
        : `Sorry, you don't have enough active invites to claim Nitro. You currently have ${inviteCount}; you need 2.`;

    await user.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("Nitro")
          .setDescription(message)
          .setColor(inviteCount >= 2 ? "#43b581" : "#ff5555")
      ]
    });
    await reaction.users.remove(user.id).catch(() => {});
  } catch (error) {
    console.error("Nitro claim reaction failed:", error);
  }
});

client.on("guildMemberAdd", member => {
  trackMemberJoin(member).catch(error =>
    console.error("Could not track member join:", error)
  );

  refreshDockForGuild(member.guild).catch(error =>
    console.error(`Could not refresh dock for guild ${member.guild.id}:`, error)
  );
});

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  if (!newMember.premiumSince || newMember.roles.cache.has(BOOSTER_REWARD_ROLE_ID)) return;

  const role = newMember.guild.roles.cache.get(BOOSTER_REWARD_ROLE_ID);
  if (!role) {
    console.error(
      `Could not award booster role ${BOOSTER_REWARD_ROLE_ID}: role was not found in guild ${newMember.guild.id}.`
    );
    return;
  }

  try {
    await newMember.roles.add(role, "Automatically awarded for boosting the server");
  } catch (error) {
    console.error(
      `Could not award booster role to member ${newMember.id} in guild ${newMember.guild.id}:`,
      error
    );
  }
});

client.on("guildUpdate", (oldGuild, newGuild) => {
  if (newGuild.premiumSubscriptionCount <= oldGuild.premiumSubscriptionCount) return;

  Object.values(giveawayData.giveaways)
    .filter(
      giveaway =>
        giveaway.guildId === newGuild.id &&
        giveaway.boostGoal &&
        !giveaway.ended &&
        newGuild.premiumSubscriptionCount >= giveaway.boostGoal
    )
    .forEach(giveaway => {
      finishBoostGiveaway(giveaway.id).catch(error =>
        console.error("Could not finish booster giveaway:", error)
      );
    });
});

client.on("guildMemberRemove", member => {
  trackMemberLeave(member).catch(error =>
    console.error("Could not track member leave:", error)
  );

  refreshDockForGuild(member.guild).catch(error =>
    console.error(`Could not refresh dock for guild ${member.guild.id}:`, error)
  );
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  const guild = newState.guild || oldState.guild;
  if (!guild) return;

  const dockChannelId = dockChannels.get(guild.id);
  if (!dockChannelId) {
    const fallback = guild.channels.cache.find(channel => channel.type === ChannelType.GuildVoice && channel.name.includes("Members:"));
    if (fallback) {
      dockChannels.set(guild.id, fallback.id);
    } else {
      return;
    }
  }

  const channel = guild.channels.cache.get(dockChannels.get(guild.id)) || await guild.channels.fetch(dockChannels.get(guild.id)).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildVoice) {
    dockChannels.delete(guild.id);
    return;
  }

  await updateDockChannel(channel);
});

client.on("channelDelete", channel => {
  if (channel && channel.type === ChannelType.GuildVoice && dockChannels.get(channel.guild.id) === channel.id) {
    dockChannels.delete(channel.guild.id);
  }
});

client.once("ready", () => {
  function randomStatus() {
    const status = [
      "Infinite Codes In Stock",
      "Working On nitro ",
      "ifwharsh is my daddy",
      "Invite Me:  >invite"
    ];
    const rstatus = Math.floor(Math.random() * status.length);

    client.user.setPresence({
      activities: [{ name: status[rstatus], type: ActivityType.Playing }],
      status: "online"
    });
  }

  setInterval(randomStatus, 5000);
  const dailyLeaderboardTimer = setInterval(() => {
    sendDailyLeaderboardCommand().catch(error =>
      console.error("Could not send daily !leaderboard command:", error)
    );
  }, DAILY_LEADERBOARD_COMMAND_INTERVAL);
  dailyLeaderboardTimer.unref();

  client.guilds.cache.forEach(guild => {
    initializeInviteTracking(guild).catch(error =>
      console.error("Could not initialize invite tracking:", error)
    );
    refreshDockForGuild(guild).catch(error =>
      console.error(`Could not refresh dock for guild ${guild.id}:`, error)
    );
  });
  restoreGiveaways().catch(error =>
    console.error("Could not restore giveaways:", error)
  );
  registerSlashCommands().catch(error =>
    console.error("Could not register slash commands:", error)
  );

  console.log("Online.");
});

client.on("messageCreate", async e => {
  if (e.channel.type === ChannelType.DM) return;
  if (e.author.bot) return;

  if (e.channel.id === ANNOUNCEMENTS_CHANNEL_ID) {
    const announcementRole = getAnnouncementsRole(e.guild);
    if (announcementRole) {
      await e.channel.send({ content: `<@&${announcementRole.id}>` }).catch(() => {});
    }
  }

  if (e.channel.id === PROOF_CHANNEL_ID) {
    const proofRole = getProofRole(e.guild);
    if (proofRole) {
      await e.channel.send({ content: `<@&${proofRole.id}>` }).catch(() => {});
    }
  }

  const rawCommand = e.content.trim().split(/ +/g);
  if (
    rawCommand[0] &&
    (rawCommand[0].toLowerCase() === "!boostgiveaway" ||
      rawCommand[0].toLowerCase() === `${finalConfig.prefix}boostgiveaway`.toLowerCase())
  ) {
    await startBoostGiveaway(e, rawCommand.slice(1)).catch(error =>
      {
        console.error("Could not create booster giveaway:", error);
        e.channel.send("I couldn't create or save the booster giveaway. Please try again.").catch(() => {});
      }
    );
    return;
  }
  if (
    rawCommand[0] &&
    rawCommand[0].toLowerCase() === "!invite-stats"
  ) {
    await getInviteStats(e, rawCommand.slice(1)).catch(error =>
      console.error("Could not get invite stats:", error)
    );
    return;
  }
  if (
    rawCommand[0] &&
    rawCommand[0].toLowerCase() === "!check" &&
    rawCommand[1] &&
    rawCommand[1].toLowerCase() === "invites"
  ) {
    await checkInvites(e, rawCommand.slice(2)).catch(error =>
      console.error("Could not check invites:", error)
    );
    return;
  }
  if (
    rawCommand[0] &&
    rawCommand[0].toLowerCase() === "!remove" &&
    rawCommand[1] &&
    rawCommand[1].toLowerCase() === "invites"
  ) {
    await removeManualInvites(e, rawCommand.slice(2)).catch(error =>
      console.error("Could not remove invites:", error)
    );
    return;
  }
  if (rawCommand[0] && rawCommand[0].toLowerCase() === "!giveaway") {
    await startGiveaway(e, rawCommand.slice(1)).catch(error =>
      console.error("Could not create giveaway:", error)
    );
    return;
  }
  if (
    rawCommand[0] &&
    rawCommand[0].toLowerCase() === "!add" &&
    rawCommand[1] &&
    rawCommand[1].toLowerCase() === "invite"
  ) {
    await addManualInvites(e, rawCommand.slice(2)).catch(error =>
      console.error("Could not add manual invites:", error)
    );
    return;
  }

  if (e.content.indexOf(finalConfig.prefix) !== 0) return;
  const t = e.content
    .slice(finalConfig.prefix.length)
    .trim()
    .split(/ +/g);
  const command = t.shift();

  if (command && command.toLowerCase() === "boost") {
    await nitrogenerator(e, t).catch(error =>
      console.error("Could not generate boost image:", error)
    );
    return;
  }

  if (command && command.toLowerCase() === "classic") {
    await nitrogenerator(e, t, "testing.html").catch(error =>
      console.error("Could not generate classic image:", error)
    );
  }
});

client.login(finalConfig.token);
