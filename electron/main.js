import { app, BrowserWindow } from "electron";
import { fork } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

let serverProcess;

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    icon: path.join(ROOT, "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  win.loadURL("http://localhost:3001");
  win.setMenu(null);
}

app.whenReady().then(() => {
  serverProcess = fork(path.join(ROOT, "server.js"), [], {
    env: { ...process.env, PORT: "3001" },
    stdio: "pipe",
  });

  serverProcess.stdout.on("data", (data) => {
    if (data.toString().includes("Server running")) createWindow();
  });

  setTimeout(createWindow, 3000);
});

app.on("will-quit", () => {
  if (serverProcess) serverProcess.kill();
});

app.on("window-all-closed", () => app.quit());
