# Discord Bot - Invite Tracker & Nitro Generator 🤖

A powerful Discord bot for tracking server invites, managing giveaways, and generating fake Nitro proofs for fun!

## Features ✨

- **📊 Advanced Invite Tracking** - Track who invited whom with detailed statistics
- **🏆 Invite Leaderboard** - Real-time leaderboard of top inviters
- **🎉 Giveaway System** - Create invite-based giveaways and booster giveaways
- **👥 Member Dock** - Voice channel that displays live member count + server boosts
- **🎟️ Invite Rewards** - Multiple reward tiers for different invite counts
- **🔧 Easy to Deploy** - Works locally or on Replit for 24/7 uptime

## Quick Start

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/imgay-gif/discord-bot.git
cd discord-bot
```

### 2️⃣ Install Dependencies
```bash
npm install
```

### 3️⃣ Setup Configuration

**Option A: Using `.env` file (Recommended)**
```bash
cp .env.example .env
```
Then edit `.env` and add your bot token:
```
TOKEN=your_bot_token_here
PREFIX=$
GUILD_ID=your_guild_id_here
PORT=3000
```

**Option B: Using `config.json`**
Edit `config.json`:
```json
{
  "token": "your_bot_token_here",
  "prefix": "$",
  "guildId": "your_guild_id_here"
}
```

### 4️⃣ Run the Bot
```bash
npm start
```

## Deploy to Replit (24/7 Uptime) 🚀

### Easy Setup (5 minutes):

1. Go to **[replit.com](https://replit.com)**
2. Click **"Create"** → **"Import from GitHub"**
3. Paste: `https://github.com/imgay-gif/discord-bot.git`
4. Click **"Secrets"** (🔒 icon) on the left sidebar
5. Add these secrets:
   - `TOKEN` = Your bot token
   - `PREFIX` = $ (or your prefix)
   - `GUILD_ID` = Your server's guild ID
6. Click **"Run"** ▶️

Your bot will now run **24/7** on Replit! ✅

## Commands 🎮

### Invite Commands (Slash & Prefix)
- `/invite-stats` or `!invite-stats` - View server invite statistics
- `/check-invites <user>` or `!check invites <user>` - Check user's invites
- `/add-invite <amount> <user>` or `!add invite <amount> <user>` - Add manual invites (Manage Server required)
- `/remove-invite <amount> <user>` or `!remove invites <amount> <user>` - Remove invites (Manage Server required)

### Other Commands
- `/panel` - Send invite check panel
- `/panel-2` - Send Nitro reward selection panel
- `/leaderboard` - Show live invite leaderboard
- `/dock` - Create member count voice channel
- `/giveaway start <duration> <winners> <prize> <invites>` - Start a giveaway
- `$classic [name] [message]` - Generate fake Nitro Classic proof
- `$boost [name] [message]` - Generate fake Nitro Booster proof

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TOKEN` | ✅ Yes | - | Your Discord bot token |
| `PREFIX` | ❌ No | `$` | Bot command prefix |
| `GUILD_ID` | ❌ No | - | Guild ID for guild-specific commands |
| `PORT` | ❌ No | `3000` | Local renderer port |

## Technologies 💻

- **Node.js** - Runtime
- **Discord.js** - Discord API
- **Express** - Local renderer server
- **Puppeteer** - Screenshot generation

## Project Structure

```
discord-bot/
├── nitro.js           # Main bot file
├── config.json        # Configuration (use .env instead)
├── .env.example       # Environment template
├── package.json       # Dependencies
├── invite-tracker.json    # Invite data storage
├── giveaways.json     # Giveaway data storage
├── testing.html       # Nitro Classic template
├── testingboost.html  # Nitro Booster template
└── images/           # UI assets
```

## Features in Detail

### 📊 Invite Tracking
- Automatically tracks who invited whom
- Shows active vs. lifetime invites
- Supports manual invite credits
- Detailed statistics per user

### 🏆 Leaderboard
- Real-time updates every 2 seconds
- Shows top 10 inviters
- Displays active members and manual credits
- Live member count dock channel

### 🎉 Giveaways
- Time-based giveaways with invite requirements
- Booster giveaways (end at X boosts)
- Reaction-based and button-based entry
- Winner notifications via DM

### 🎟️ Reward System
- Bronze: 2 invites
- Silver: 5 invites
- Gold: 10 invites
- Platinum: 15+ invites

## Troubleshooting

### Bot won't start
- Check your `TOKEN` in `.env` or `config.json`
- Make sure Node.js is installed: `node --version`

### Invites not tracking
- Give bot **Manage Server** permission
- Enable **Server Members Intent** in Discord Developer Portal
- Make sure bot is in the server before members join

### Giveaway won't start
- Check you have **Manage Server** permission
- Duration format: `2h`, `30m`, `1d`, etc.

## License 📄

MIT - See LICENSE file

## Support

For issues or questions, check the README or reach out!

---

**Enjoy your Discord bot! 🎉**
