const { commands, aliases } = global.GoatBot;
const axios = require('axios');

function toCmdFont(text = "") {
  const map = {
    A:"𝖠",B:"𝖡",C:"𝖢",D:"𝖣",E:"𝖤",F:"𝖥",G:"𝖦",H:"𝖧",I:"𝖨",J:"𝖩",
    K:"𝖪",L:"𝖫",M:"𝖬",N:"𝖭",O:"𝖮",P:"𝖯",Q:"𝖰",R:"𝖱",S:"𝖲",T:"𝖳",
    U:"𝖴",V:"𝖵",W:"𝖶",X:"𝖷",Y:"𝖸",Z:"𝖹",
    a:"𝖺",b:"𝖻",c:"𝖼",d:"𝖽",e:"𝖾",f:"𝖿",g:"𝗀",h:"𝗁",i:"𝗂",j:"𝗃",
    k:"𝗄",l:"𝗅",m:"𝗆",n:"𝗇",o:"𝗈",p:"𝗉",q:"𝗊",r:"𝗋",s:"𝗌",t:"𝗍",
    u:"𝗎",v:"𝗏",w:"𝗐",x:"𝗑",y:"𝗒",z:"𝗓",
    " ":" "
  };
  return text.split("").map(c => map[c] || c).join("");
}

function toQuestionFont(text = "") {
  const map = {
    A:"𝐴",B:"𝐵",C:"𝐶",D:"𝐷",E:"𝐸",F:"𝐹",G:"𝐺",H:"𝐻",I:"𝐼",J:"𝐽",
    K:"𝐾",L:"𝐿",M:"𝑀",N:"𝑁",O:"𝑂",P:"𝑃",Q:"𝑄",R:"𝑅",S:"𝑆",T:"𝑇",
    U:"𝑈",V:"𝑉",W:"𝑊",X:"𝑋",Y:"𝑌",Z:"𝑍",
    a:"𝑎",b:"𝑏",c:"𝑐",d:"𝑑",e:"𝑒",f:"𝑓",g:"𝑔",h:"ℎ",i:"𝑖",j:"𝑗",
    k:"𝑘",l:"𝑙",m:"𝑚",n:"𝑛",o:"𝑜",p:"𝑝",q:"𝑞",r:"𝑟",s:"𝑠",t:"𝑡",
    u:"𝑢",v:"𝑣",w:"𝑤",x:"𝑥",y:"𝑦",z:"𝑧",
    " ":" "
  };
  return text.split("").map(c => map[c] || c).join("");
}

module.exports = {
  config: {
    name: "help",
    version: "6.3",
    author: "Christus",
    countDown: 2,
    role: 0,
    shortDescription: { en: "Explore all bot commands" },
    category: "info",
    guide: { en: "help <command> | help -ai <cmd> <question>" },
  },

  onStart: async function ({ message, args, event, usersData }) {
    try {
      const uid = event.senderID;

      let avatarStream;
      try {
        const avatarUrl = await usersData.getAvatarUrl(uid);
        avatarStream = await global.utils.getStreamFromURL(avatarUrl);
      } catch {
        avatarStream = await global.utils.getStreamFromURL(
          `https://graph.facebook.com/${uid}/picture?width=720&height=720`
        );
      }

      if (args[0]?.toLowerCase() === "-ai") {
        const cmdName = args[1]?.toLowerCase();
        const questionRaw = args.slice(2).join(" ");

        if (!cmdName) {
          return message.reply({
            body: "❌ Usage: .help -ai <command> <question>",
            attachment: avatarStream
          });
        }

        const command =
          commands.get(cmdName) ||
          commands.get(aliases.get(cmdName));

        if (!command) {
          return message.reply({
            body: `❌ Command "${cmdName}" not found.`,
            attachment: avatarStream
          });
        }

        const cfg = command.config || {};

        const info = `
Command Name: ${cfg.name}
Description: ${cfg.longDescription?.en || cfg.shortDescription?.en || "No description"}
Category: ${cfg.category || "Misc"}
Aliases: ${Array.isArray(cfg.aliases) ? cfg.aliases.join(", ") : "None"}
Role: ${cfg.role}
Cooldown: ${cfg.countDown}
Version: ${cfg.version}
Author: ${cfg.author}
Guide: ${cfg.guide?.en || "No guide"}
`;

        const prompt = `
You are a GoatBot assistant that helps users understand commands.

Here is the command info:
${info}

User question:
${questionRaw || "Explain how to use this command."}

Answer clearly in the user's language without using * characters.
`;

        try {
          const apiUrl = `https://christus-api.vercel.app/ai/gemini-proxy2?prompt=${encodeURIComponent(prompt)}`;
          const { data } = await axios.get(apiUrl);

          let aiReply = data?.result || "No AI response.";
          aiReply = aiReply.replace(/\*/g, "");

          const styledQuestion = toQuestionFont(questionRaw || "Explain how to use this command.");

          return message.reply({
            body:
`🤖 AI Assistant — ${cfg.name}

❓ ${styledQuestion}

${aiReply}`,
            attachment: avatarStream
          });

        } catch (err) {
          console.error(err);
          return message.reply({
            body: "❌ AI request failed.",
            attachment: avatarStream
          });
        }
      }

      if (!args || args.length === 0) {
        let body = "📚 GOAT BOT COMMANDS\n\n";

        const categories = {};
        for (let [name, cmd] of commands) {
          const cat = cmd.config.category || "Misc";
          if (!categories[cat]) categories[cat] = [];
          categories[cat].push(name);
        }

        for (const cat of Object.keys(categories).sort()) {
          const list = categories[cat]
            .sort()
            .map(c => `• ${toCmdFont(c)}`)
            .join("  ");

          body += `🍂 ${cat}\n${list || "No commands"}\n\n`;
        }

        body += `📊 Total Commands: ${commands.size}\n`;
        body += `🔧 Info: .help <command>\n`;
        body += `🤖 AI Help: .help -ai <command> <question>\n`;

        return message.reply({
          body,
          attachment: avatarStream
        });
      }

      const query = args[0].toLowerCase();

      const command =
        commands.get(query) ||
        commands.get(aliases.get(query));

      if (!command) {
        return message.reply({
          body: `❌ Command "${query}" not found.`,
          attachment: avatarStream
        });
      }

      const cfg = command.config || {};

      const roleMap = {
        0: "All Users",
        1: "Group Admins",
        2: "Bot Admins"
      };

      const aliasesList = Array.isArray(cfg.aliases) && cfg.aliases.length
        ? cfg.aliases.map(a => toCmdFont(a)).join(", ")
        : "None";

      const desc =
        cfg.longDescription?.en ||
        cfg.shortDescription?.en ||
        "No description.";

      const usage = cfg.guide?.en || cfg.name;

      const card = [
        `✨ ${toCmdFont(cfg.name)} ✨`,
        `📝 Description: ${desc}`,
        `📂 Category: ${cfg.category || "Misc"}`,
        `🔤 Aliases: ${aliasesList}`,
        `🛡️ Role: ${roleMap[cfg.role] || "Unknown"} | ⏱️ Cooldown: ${cfg.countDown || 1}s`,
        `🚀 Version: ${cfg.version || "1.0"} | 👨‍💻 Author: ${cfg.author || "Unknown"}`,
        `💡 Usage: .${toCmdFont(usage)}`
      ].join("\n");

      return message.reply({
        body: card,
        attachment: avatarStream
      });

    } catch (err) {
      console.error("HELP ERROR:", err);
      return message.reply(`⚠️ Error: ${err.message || err}`);
    }
  }
};
