import { chmod, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";

const target = resolve(process.cwd(), ".env.local");

async function readVisible(prompt, fallback) {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const value = (await terminal.question(`${prompt} [${fallback}]: `)).trim();
    return value || fallback;
  } finally {
    terminal.close();
  }
}

function readHidden(prompt) {
  return new Promise((resolveValue, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error("Run this command in an interactive terminal."));
      return;
    }

    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    let value = "";

    const finish = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("data", onData);
      process.stdout.write("\n");
      resolveValue(value.trim());
    };

    const onData = (character) => {
      if (character === "\u0003") {
        process.stdin.setRawMode(false);
        process.stdout.write("\n");
        process.exit(130);
      }
      if (character === "\r" || character === "\n") {
        finish();
        return;
      }
      if (character === "\u007f") {
        value = value.slice(0, -1);
        return;
      }
      value += character;
    };

    process.stdin.on("data", onData);
  });
}

try {
  const baseUrl = await readVisible("OpenAI-compatible Base URL", "https://api.openai.com/v1");
  let parsedBaseUrl;
  try {
    parsedBaseUrl = new URL(baseUrl);
  } catch {
    throw new Error("The Base URL must be a valid http(s) URL.");
  }
  if (!["http:", "https:"].includes(parsedBaseUrl.protocol)) {
    throw new Error("The Base URL must use http or https.");
  }

  const key = await readHidden("Paste the API key (input hidden): ");
  if (!key || key.length < 20) throw new Error("The API key was empty or too short.");

  const content = [
    `OPENAI_API_KEY=${key}`,
    `OPENAI_BASE_URL=${parsedBaseUrl.href.replace(/\/$/, "")}`,
    "OPENAI_MODEL=gpt-5.6-sol",
    "OPENAI_REASONING_EFFORT=max",
    "OPENAI_TIMEOUT_MS=120000",
    "HOST=127.0.0.1",
    "PORT=4173",
    "TRUST_PROXY=0",
    ""
  ].join("\n");

  await writeFile(target, content, { encoding: "utf8", mode: 0o600 });
  await chmod(target, 0o600);
  process.stdout.write(`Saved server configuration to ${target}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
