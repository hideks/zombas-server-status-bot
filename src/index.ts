import 'dotenv/config';
import { Client, GatewayIntentBits, TextChannel } from "discord.js";
import express, { Response } from 'express';

const TOKEN = process.env.DISCORD_TOKEN;

const STATUS_CHANNEL_ID = "1471274139250589887";
const MESSAGE_ID = '1471589635443392645'

const LOKI_URL = "http://zombas.ddns.net:13100";
const LOKI_QUERY = '{job="zomboid",source="server"} |~ "SERVER STARTED|Server exited"';

const SECONDS = 30

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

interface LokiResponse {
    data: {
        result: {
            values: [string, string][]
        }[];
    };
}

async function getServerStatus(): Promise<boolean> {
    try {
        const now = Date.now();
        const start = (now - 24 * 60 * 60 * 1000) * 1_000_000;
        const end = now * 1_000_000;

        const params = new URLSearchParams({
            query: LOKI_QUERY,
            start: start.toString(),
            end: end.toString(),
            limit: "1"
        });

        const url = `${LOKI_URL}/loki/api/v1/query_range?${params}`

        const res = await fetch(url);

        if (!res.ok) {
            console.error("Loki HTTP error:", res.status);
            console.error(res.body)
            return false
        }

        const json = await res.json() as LokiResponse;

        if (!json.data.result.length) {
            console.log('No logs')
            return false;
        }

        const logLine = json.data.result[0].values[0][1];

        return logLine.includes("SERVER STARTED")
    } catch (err) {
        console.log(err)
        return false
    }
}

async function getLastServerStart(): Promise<bigint | null> {
    const now = Date.now();
    const start = (now - 24 * 60 * 60 * 1000) * 1_000_000;
    const end = now * 1_000_000;

    const params = new URLSearchParams({
        query: '{job="zomboid",source="server"} |= "SERVER STARTED"',
        start: start.toString(),
        end: end.toString(),
        limit: "1"
    });

    const url = `${LOKI_URL}/loki/api/v1/query_range?${params.toString()}`;

    const res = await fetch(url);
    const json = await res.json() as LokiResponse;

    if (!json.data.result.length) return null;

    const timestamp = json.data.result[0].values[0][0];

    return BigInt(timestamp);
}

async function getOnlinePlayers(startTimestamp: bigint | null): Promise<string[]> {
    if (!startTimestamp) return []

    const now = BigInt(Date.now()) * 1_000_000n;

    const params = new URLSearchParams({
        direction: 'forward',
        query: '{job="zomboid",source="server"} |~ "fully connected|disconnected player"',
        start: startTimestamp.toString(),
        end: now.toString(),
        limit: "500"
    });

    const url = `${LOKI_URL}/loki/api/v1/query_range?${params}`

    const res = await fetch(url);

    const json = await res.json() as LokiResponse;

    const playerState = new Map<string, boolean>();

    for (const stream of json.data.result) {
        for (const value of stream.values) {
            const line = value[1];

            const connectMatch = line.match(/"(.+?)" fully connected/);
            if (connectMatch) {
                playerState.set(connectMatch[1], true)
            }

            const disconnectMatch = line.match(/"(.+?)" disconnected player/);
            if (disconnectMatch) {
                playerState.set(disconnectMatch[1], false)
            }
        }
    }

    return Array.from(playerState.entries())
        .filter(([_, online]) => online)
        .map(([name]) => name);
}

async function updateDiscord() {
    const online = await getServerStatus();

    console.log({ online })

    let players: string[] = []

    if (online) {
        const lastServerStart = await getLastServerStart()
        players = await getOnlinePlayers(lastServerStart);
        console.log({ players })
    }

    const statusChannel = await client.channels.fetch(STATUS_CHANNEL_ID);

    if (!statusChannel || !(statusChannel instanceof TextChannel)) return;

    await (statusChannel as any).edit({
        name: online ? `🟢online|👥${players.length}` : "🔴offline"
    });

    const content = players.length
        ? `Online no momento:\n\n${players.map(p => `• ${p}`).join("\n")}\n`
        : "Os zumbis estão carentes, seja o primeiro a matar a saudade deles!"

    const botMessage = await statusChannel.messages.fetch(MESSAGE_ID);
    await botMessage.edit(content)
}

client.once("clientReady", () => {
    console.log("Bot is running");

    setInterval(() => {
        updateDiscord().catch(err => {
            console.error("Update Error:", err)
        });
    }, SECONDS * 1000);
});

client.rest.on("rateLimited", (info) => {
    console.warn("Rate limit hit:");
    console.warn(`Route: ${info.route}`);
    console.warn(`Time to reset: ${info.timeToReset}ms`);
    console.warn(`Limit: ${info.limit}`);
});

client.login(TOKEN);

const app = express();

app.get('/', (_, response: Response) => {
    response.send('Bot is Online!');
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
