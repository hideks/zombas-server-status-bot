# Zombas Server Status Bot

A Discord bot designed to provide real-time monitoring of Zombas server status using log data.

### Features
- **Live Status Monitoring:** Real-time tracking of whether the server is Online or Offline.
- **Player Counter:** Dynamic display of the current number of players.
- **Live Player List:** Automatically updates a list of currently active player names.
- **Loki Integration:** Leverages LogQL to fetch data directly from your Grafana Loki instance.

### Tech Stack
- **Runtime:** Node
- **Language:** Typescript
- **Library:** Discord.js v14
- **Data:** Grafana Loki (LogQL)
- **Hosting:** [Discloud](https://discloud.com/)

### Instalation & Setup

1. Clone the repository:
```bash
git clone https://github.com/hideks/zombas-server-status-bot.git
cd zombas-server-status-bot
```

2. Install dependencies:
```bash
npm install
```

3. Build and Run:
```bash
npm run dev
```
or
```bash
npm run build
npm start
```
