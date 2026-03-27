import "dotenv/config";
import http from "http";
import { once } from "events";
import { QueryProtocol, TeamSpeak } from "ts3-nodejs-library";
import { Client, Events, GatewayIntentBits } from "discord.js";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (v === undefined || v === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export interface IChannelData {
  id: string;
  name: string;
  clients: IClientData[];
}

export interface IClientData {
  id: string;
  name: string;
  inputMuted: boolean;
  outputMuted: boolean;
}

async function getChannelData(ts3: TeamSpeak): Promise<IChannelData[]> {
  const channels = await ts3.channelList();

  return await Promise.all(
    channels.map(async (x) => ({
      id: x.cid,
      name: x.name,
      clients: (await x.getClients({ clientType: 0 })).map((y) => ({
        id: y.clid,
        name: y.nickname,
        inputMuted: y.inputMuted,
        outputMuted: y.outputMuted,
      })),
    })),
  );
}

async function getMessageContent(ts3: TeamSpeak): Promise<string> {
  const data = await getChannelData(ts3);

  const lastUpdated = new Date();
  const formattedDate = lastUpdated.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const header = `**Last Updated:** ${formattedDate}\n\n`;

  return (
    header +
    data
      .map((channel) => {
        const channelInfo = `**${channel.name}**`;
        const clientsInfo =
          channel.clients.length > 0
            ? channel.clients
                .map(
                  (client) =>
                    `- ${client.name}${client.inputMuted ? " 🎤" : ""}${
                      client.outputMuted ? " 🔇" : ""
                    }`,
                )
                .join("\n")
            : "";

        return `${channelInfo}${clientsInfo ? `\n${clientsInfo}` : ""}`;
      })
      .join("\n\n")
  );
}

async function onCron(ts3: TeamSpeak, discord: Client): Promise<void> {
  const content = await getMessageContent(ts3);
  const channelId = requireEnv("DISCORD_CHANNEL_ID");
  const channel = await discord.channels.fetch(channelId);
  if (!channel?.isTextBased() || !channel.isSendable()) {
    throw new Error("channel not found");
  }

  const messages = await channel.messages.fetch({ limit: 1 });
  const latestMessage = messages.first();

  if (latestMessage) {
    await latestMessage.edit(content);
  } else {
    await channel.send(content);
  }
}

function createDiscordClient(): Client {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });
}

async function connectTeamSpeak(): Promise<TeamSpeak> {
  return TeamSpeak.connect({
    host: requireEnv("HOST"),
    protocol: QueryProtocol.RAW,
    queryport: Number(requireEnv("QUERY_PORT")),
    serverport: Number(requireEnv("PORT")),
    username: requireEnv("USERNAME"),
    password: requireEnv("PASSWORD"),
    nickname: requireEnv("NICKNAME"),
  });
}

async function runOneShot(): Promise<void> {
  let ts3: TeamSpeak | undefined;
  let discord: Client | undefined;
  try {
    ts3 = await connectTeamSpeak();
    console.log("TS3 instance set");

    discord = createDiscordClient();
    discord.on("error", (e) => {
      console.error("Discord error!", e);
    });

    await discord.login(requireEnv("DISCORD_TOKEN"));
    await once(discord, Events.ClientReady);
    console.log("Discord instance set");

    await onCron(ts3, discord);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    if (ts3) {
      try {
        await ts3.quit();
      } catch {
        /* ignore */
      }
    }
    if (discord) {
      try {
        await discord.destroy();
      } catch {
        /* ignore */
      }
    }
  }
}

async function runServer(): Promise<void> {
  const ts3 = await connectTeamSpeak();
  console.log("TS3 instance set");

  const discord = createDiscordClient();
  discord.on("error", (e) => {
    console.error("Discord error!", e);
  });

  await discord.login(requireEnv("DISCORD_TOKEN"));
  await once(discord, Events.ClientReady);
  console.log("Discord instance set");

  const listenPort =
    Number(process.env.DEV_SERVER_PORT ?? 3000) || 3000;

  const intervalParsed = Number.parseInt(
    process.env.DEV_UPDATE_INTERVAL_MS ?? "",
    10,
  );
  const intervalMs =
    Number.isFinite(intervalParsed) && intervalParsed > 0
      ? intervalParsed
      : 60_000;

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

      if (url.pathname === "/channels" && req.method === "GET") {
        const data = await getChannelData(ts3);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(data));
        return;
      }

      if (url.pathname === "/update" && req.method === "GET") {
        await onCron(ts3, discord);
        res.writeHead(200);
        res.end();
        return;
      }

      res.writeHead(200);
      res.end("Hello, World!");
    } catch (e) {
      console.error(e);
      res.writeHead(500);
      res.end();
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(listenPort, () => {
      console.log(
        `Listening on ${listenPort} (Discord refresh every ${intervalMs}ms)`,
      );
      resolve();
    });
  });

  const timer = setInterval(() => {
    onCron(ts3, discord).catch((e) => console.error(e));
  }, intervalMs);

  const shutdown = async () => {
    clearInterval(timer);
    server.close();
    try {
      await ts3.quit();
    } catch {
      /* ignore */
    }
    try {
      await discord.destroy();
    } catch {
      /* ignore */
    }
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });
}

async function main(): Promise<void> {
  if (process.env.ONE_SHOT === "true") {
    await runOneShot();
    process.exit(process.exitCode ?? 0);
    return;
  }

  await runServer();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
