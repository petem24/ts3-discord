import { QueryProtocol, TeamSpeak } from "npm:ts3-nodejs-library";
import { Client, TextChannel } from "npm:discord.js";

/**
 * Teamspeak setup
 */
let ts3: TeamSpeak;
TeamSpeak.connect({
  host: Deno.env.get("HOST"),
  protocol: QueryProtocol.RAW,
  queryport: Number(Deno.env.get("QUERY_PORT")),
  serverport: Number(Deno.env.get("PORT")),
  username: Deno.env.get("USERNAME"),
  password: Deno.env.get("PASSWORD"),
  nickname: Deno.env.get("NICKNAME"),
}).then((teamspeak) => {
  ts3 = teamspeak;
  console.log("TS3 instance set");
}).catch((e) => {
  console.log("TS3 error!");
  console.error(e);
});

/**
 * Discord Setup
 */
const discord = new Client({
  intents: ["GuildMessages", "Guilds", "MessageContent"],
});

discord.on("ready", () => {
  console.log("Discord instance set");
});

discord.on("error", (e) => {
  console.log("Discord error!");
  console.error(e);
});

discord.login(Deno.env.get("DISCORD_TOKEN"));

/**
 * Web Server setup (this was for development only)
 */
Deno.serve(async (_req) => {
  const channelListRes = await channelList(_req);
  if (channelListRes) {
    return channelListRes;
  }

  const updateRes = await updateMessage(_req);
  if (updateRes) {
    return updateRes;
  }

  return new Response("Hello, World!");
});

const channelList = async (req: Request): Promise<Response | undefined> => {
  const url = new URLPattern({ pathname: "/channels" });
  const match = url.exec(req.url);

  if (!match) return;

  return new Response(JSON.stringify(await getChannelData()), {
    headers: { "Content-Type": "application/json" },
  });
};

const updateMessage = async (req: Request): Promise<Response | undefined> => {
  const url = new URLPattern({ pathname: "/update" });
  const match = url.exec(req.url);

  if (!match) return;

  await onCron();

  return new Response();
};

/**
 * Cron setup
 */
Deno.cron("messageUpdate", { minute: { every: 1 } }, async () => {
  await onCron();
});

const onCron = async () => {
  const content = await getMessageContent();
  const channel = discord.channels.cache.get(
    Deno.env.get("DISCORD_CHANNEL_ID") as string,
  ) as TextChannel;

  if (!channel) throw new Error("channel not found");

  const messages = await channel.messages.fetch({ limit: 1 }) as any;
  const latestMessage = messages.first();

  if (latestMessage) {
    await latestMessage.edit(content);
  } else {
    await channel.send(content);
  }
};

/**
 * Random functions
 */
const getChannelData = async () => {
  const channels = await ts3.channelList();

  return await Promise.all<IChannelData>(channels.map(async (x) => {
    return {
      id: x.cid,
      name: x.name,
      clients: (await x.getClients({ clientType: 0 })).map((y) => {
        return {
          id: y.clid,
          name: y.nickname,
          inputMuted: y.inputMuted,
          outputMuted: y.outputMuted,
        };
      }),
    };
  }));
};

const getMessageContent = async () => {
  const data = await getChannelData();

  const lastUpdated = new Date();
  const formattedDate = lastUpdated.toLocaleString(); // Customize format as needed

  const header = `**Last Updated:** ${formattedDate}\n\n`;

  return (
    header +
    data
      .map((channel) => {
        const channelInfo = `**${channel.name}**`;
        const clientsInfo = channel.clients.length > 0
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
};

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
