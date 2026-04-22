const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("repologDesktop", {
  onHtml(callback) {
    if (typeof callback !== "function") {
      return;
    }

    ipcRenderer.on("repolog:html", (_event, html) => {
      callback(html);
    });
  },
  requestRefresh() {
    ipcRenderer.send("repolog:refresh");
  },
  openRepoPicker() {
    ipcRenderer.send("repolog:open-repo");
  },
  openConfigFile() {
    ipcRenderer.send("repolog:open-config");
  },
  rememberStartupRoot() {
    ipcRenderer.send("repolog:remember-startup-root");
  },
  forgetStartupRoot() {
    ipcRenderer.send("repolog:forget-startup-root");
  },
  openDoc(doc, line) {
    ipcRenderer.send("repolog:open-doc", { doc, line });
  },
  toggleChecklist(doc, line, text, checked) {
    return ipcRenderer.invoke("repolog:toggle-checklist", { doc, line, text, checked });
  },
  runDoctor() {
    return ipcRenderer.invoke("repolog:run-doctor");
  },
  windowAction(action) {
    ipcRenderer.send("repolog:window-action", action);
  },
});
