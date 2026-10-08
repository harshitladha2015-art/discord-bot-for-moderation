const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  AttachmentBuilder,
  ActivityType,
  ChannelType
} = require("discord.js");

const client = new Client({
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers
  ]
});

const config = require("./config.json");
const puppeteer = require("puppeteer");
const express = require("express");
const app = express();
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT || 3000);
let datatosend = "";

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
app.get("/", function (e, t) {
  t.send(datatosend);
});

const renderServer = app.listen(port, () => {
  console.log(`Renderer listening at http://localhost:${port}`);
});

const inviteTrackerFile = path.join(__dirname, "invite-tracker.json");
let inviteTracker = loadInviteTracker();
let inviteTrackerWrite = Promise.resolve();

function loadInviteTracker() {
  try {
    const saved = JSON.parse(fs.readFileSync(inviteTrackerFile, "utf8"));
    return saved && saved.guilds ? saved : { guilds: {} };
  } catch (error) {
    return { guilds: {} };
  }
}

function getInviteState(guildId) {
  if (!inviteTracker.guilds[guildId]) {
    inviteTracker.guilds[guildId] = {
      initialized: false,
      invites: {},
      members: {}
    };
  }

  const state = inviteTracker.guilds[guildId];
  state.invites = state.invites || {};
  state.members = state.members || {};
  return state;
}

function saveInviteTracker() {
  inviteTrackerWrite = inviteTrackerWrite
    .catch(() => {})
    .then(() =>
      fs.promises.writeFile(
        inviteTrackerFile,
        JSON.stringify(inviteTracker, null, 2)
      )
    )
    .catch(error => console.error("Could not save invite tracker:", error));
  return inviteTrackerWrite;
}

async function fetchInviteSnapshot(guild) {
  const invites = await guild.fetchInvites().catch(() => null);
  if (!invites) return null;

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
  const snapshot = await fetchInviteSnapshot(guild);
  if (!snapshot) return;

  const state = getInviteState(guild.id);
  state.invites = snapshot;
  state.initialized = true;
  await saveInviteTracker();
}

async function trackMemberJoin(member) {
  if (!member.guild || (member.user && member.user.bot)) return;

  const state = getInviteState(member.guild.id);
  const snapshot = await fetchInviteSnapshot(member.guild);
  if (!snapshot) return;

  if (!state.initialized) {
    state.invites = snapshot;
    state.initialized = true;
    await saveInviteTracker();
    return;
  }

  let matchedInvite = null;
  let largestIncrease = 0;
  Object.keys(snapshot).forEach(code => {
    const previous = state.invites[code];
    const increase = snapshot[code].uses - (previous ? previous.uses || 0 : 0);
    if (increase > largestIncrease && snapshot[code].inviterId) {
      largestIncrease = increase;
      matchedInvite = snapshot[code];
    }
  });

  state.invites = snapshot;
  if (matchedInvite) {
    state.members[member.id] = matchedInvite.inviterId;
  } else {
    delete state.members[member.id];
  }
  await saveInviteTracker();
}

async function trackMemberLeave(member) {
  if (!member.guild) return;

  const state = getInviteState(member.guild.id);
  if (state.members[member.id]) {
    delete state.members[member.id];
    await saveInviteTracker();
  }
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
          }
          return;
        }
      }
      count += 1;
    })
  );

  if (changed) await saveInviteTracker();
  return count;
}

const leaderboardBoards = new Map();

function createLeaderboardEmbed(guild) {
  const state = getInviteState(guild.id);
  const counts = {};

  Object.values(state.members).forEach(inviterId => {
    counts[inviterId] = (counts[inviterId] || 0) + 1;
  });

  const rows = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([inviterId, count], index) => {
      const member = guild.members.cache.get(inviterId);
      const name = member ? member.user.tag : `<@${inviterId}>`;
      return `**${index + 1}.** ${name} — **${count}** active invitee${count === 1 ? "" : "s"}`;
    });

  return new EmbedBuilder()
    .setTitle("Invite Leaderboard")
    .setDescription(rows.length ? rows.join("\n") : "No tracked active invitees yet.")
    .setColor("#5865F2")
    .setFooter({ text: "Updates every 2 seconds" });
}

async function refreshLeaderboard(board) {
  if (!board.message || board.message.deleted) {
    clearInterval(board.timer);
    leaderboardBoards.delete(board.key);
    return;
  }

  await board.message.edit({ embeds: [createLeaderboardEmbed(board.guild)] });
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

async function nitrogenerator(e, t) {
  const a = formatAMPM(new Date());
  const n = formatAMPM(new Date(Date.now() - 6e4));
  let o = await fs.readFileSync(`${__dirname}/testing.html`, "utf8");

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

  datatosend = o;
  datatosend = datatosend.replace(
    "FIRSTAUTHORURL",
    e.author.displayAvatarURL({ extension: "png", size: 256 })
  );
  datatosend = datatosend.replace("THEFIRSTAUTHOR", e.author.username);
  datatosend = datatosend.replace(
    "SECONDAUTHORURL",
    targetUser.displayAvatarURL({ extension: "png", size: 256 })
  );
  datatosend = datatosend.replace("THESECONDAUTHOR", targetName);
  datatosend = datatosend.replace("RESPONSETONITRO", targetMessage);
  datatosend = datatosend.replace("FIRSTAUTHORDATE", "Today at " + n);
  datatosend = datatosend.replace("SECONDAUTHORDATE", "Today at " + a);
  datatosend = datatosend.split("http://localhost:3000/font").join(`http://localhost:${port}/font`);
  datatosend = datatosend
    .split("https://cdn.discordapp.com/attachments/782434583974248511/793316025244057630/nitroregular.png")
    .join(`http://localhost:${port}/nitroclassic.png`);

  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  let c;
  try {
    const page = await browser.newPage();
    await page.goto(`http://localhost:${port}`, { waitUntil: "networkidle0" });
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
    await browser.close();
  }

  const imgBuffer = Buffer.isBuffer(c) ? c : Buffer.from(c || []);
  if (!imgBuffer || imgBuffer.length === 0) {
    throw new Error("Puppeteer screenshot returned an empty image buffer.");
  }

  const attachment = new AttachmentBuilder(imgBuffer, { name: "NitroProof.png" });
  await e.channel.send({ content: `${e.author}`, files: [attachment] });
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
    if (reaction.partial) {
      await reaction.fetch();
    }

    let panelMessage = reaction.message;
    if (panelMessage.partial) {
      panelMessage = await panelMessage.fetch();
    }

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
  const panel = new EmbedBuilder()
    .setTitle(PANEL_TITLE)
    .setDescription("Check your invites to claim a reward")
    .setColor("#5865F2")
    .setFooter({ text: PANEL_FOOTER });

  const panelMessage = await e.channel.send({ embeds: [panel] });
  await panelMessage.react("🎟️");
}

async function sendNitroRequestPanel(e) {
  const panel = new EmbedBuilder()
    .setTitle("Nitro request")
    .setDescription("Wanna claim your nitro for invites? React with 🎟️ below.")
    .setColor("#5865F2")
    .setFooter({ text: "React with 🎟️ to claim" });

  const panelMessage = await e.channel.send({ embeds: [panel] });
  await panelMessage.react("🎟️");
}

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
      panelEmbed.footer.text !== "React with 🎟️ to claim"
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
});

client.on("guildMemberRemove", member => {
  trackMemberLeave(member).catch(error =>
    console.error("Could not track member leave:", error)
  );
});

client.on("ready", () => {
  function randomStatus() {
    const status = [
      "Infinite Codes In Stock",
      "Generating Codes",
      "Stealing Emojis",
      "Invite Me:  >invite",
      "!! Snowwy#1337 Is My Dad"
    ];
    const rstatus = Math.floor(Math.random() * status.length);

    client.user.setPresence({
      activities: [{ name: status[rstatus], type: ActivityType.Playing }],
      status: "online"
    });
  }

  setInterval(randomStatus, 5000);

  client.guilds.cache.forEach(guild => {
    initializeInviteTracking(guild).catch(error =>
      console.error("Could not initialize invite tracking:", error)
    );
  });

  console.log("Online.");
});

client.on("messageCreate", async e => {
  if (e.channel.type === ChannelType.DM) return;
  if (e.author.bot) return;

  const lower = e.content.toLowerCase();
  if (lower === "!panel" || lower === `${config.prefix}panel`) {
    await sendInvitePanel(e).catch(error =>
      console.error("Could not create invite panel:", error)
    );
    return;
  }
  if (lower === "!panel-2" || lower === `${config.prefix}panel-2`) {
    await sendNitroRequestPanel(e).catch(error =>
      console.error("Could not create Nitro request panel:", error)
    );
    return;
  }
  if (lower === "!leaderboard" || lower === `${config.prefix}leaderboard`) {
    await sendLeaderboard(e).catch(error =>
      console.error("Could not create invite leaderboard:", error)
    );
    return;
  }

  if (e.content.indexOf(config.prefix) !== 0) return;
  const t = e.content
    .slice(config.prefix.length)
    .trim()
    .split(/ +/g);
  const command = t.shift();

  if (command && command.toLowerCase() === "panel") {
    await sendInvitePanel(e).catch(error =>
      console.error("Could not create invite panel:", error)
    );
    return;
  }

  if (command && command.toLowerCase() === "classic") {
    await nitrogenerator(e, t).catch(error =>
      console.error("Could not generate classic image:", error)
    );
  }
});

client.login(config.token);
