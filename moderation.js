const fs = require("fs");
const path = require("path");
const { EmbedBuilder } = require("discord.js");

const modFile = path.join(__dirname, "moderation-data.json");

function loadModData() {
  try {
    return JSON.parse(fs.readFileSync(modFile, "utf8"));
  } catch (error) {
    return { warns: {}, bans: {}, mutes: {} };
  }
}

function saveModData(data) {
  fs.writeFileSync(modFile, JSON.stringify(data, null, 2));
}

async function warnUser(guild, userId, reason, moderatorId) {
  const data = loadModData();
  const guildWarns = data.warns[guild.id] || {};
  const userWarns = guildWarns[userId] || [];
  
  userWarns.push({
    reason,
    moderatorId,
    timestamp: Date.now()
  });
  
  guildWarns[userId] = userWarns;
  data.warns[guild.id] = guildWarns;
  saveModData(data);
  
  return userWarns.length;
}

async function getWarns(guild, userId) {
  const data = loadModData();
  return (data.warns[guild.id] || {})[userId] || [];
}

async function clearWarns(guild, userId) {
  const data = loadModData();
  if (data.warns[guild.id]) {
    delete data.warns[guild.id][userId];
    saveModData(data);
  }
}

async function banUser(guild, userId, reason) {
  const data = loadModData();
  const guildBans = data.bans[guild.id] || {};
  
  guildBans[userId] = {
    reason,
    timestamp: Date.now()
  };
  
  data.bans[guild.id] = guildBans;
  saveModData(data);
}

async function getBans(guild) {
  const data = loadModData();
  return data.bans[guild.id] || {};
}

function createWarnEmbed(userId, warnCount, reason) {
  return new EmbedBuilder()
    .setTitle("⚠️ Warning")
    .setDescription(`<@${userId}> has been warned.\n**Reason:** ${reason}\n**Total Warns:** ${warnCount}`)
    .setColor("#FFAA00")
    .setTimestamp();
}

function createBanEmbed(userId, reason) {
  return new EmbedBuilder()
    .setTitle("🔨 User Banned")
    .setDescription(`<@${userId}> has been banned.\n**Reason:** ${reason}`)
    .setColor("#FF0000")
    .setTimestamp();
}

function createKickEmbed(userId, reason) {
  return new EmbedBuilder()
    .setTitle("👢 User Kicked")
    .setDescription(`<@${userId}> has been kicked.\n**Reason:** ${reason}`)
    .setColor("#FF6600")
    .setTimestamp();
}

module.exports = {
  warnUser,
  getWarns,
  clearWarns,
  banUser,
  getBans,
  createWarnEmbed,
  createBanEmbed,
  createKickEmbed,
  loadModData,
  saveModData
};
