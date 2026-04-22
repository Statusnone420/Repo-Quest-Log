import { spawn } from "node:child_process";

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (process.platform === "win32") {
    return writeToClipboardCommand("clip", [], text);
  }

  if (process.platform === "darwin") {
    return writeToClipboardCommand("pbcopy", [], text);
  }

  if (await writeToClipboardCommand("xclip", ["-selection", "clipboard"], text)) {
    return true;
  }

  return writeToClipboardCommand("xsel", ["--clipboard", "--input"], text);
}

function writeToClipboardCommand(command: string, args: string[], text: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["pipe", "ignore", "ignore"] });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
    child.stdin.write(text, "utf8", () => {
      child.stdin.end();
    });
  });
}
