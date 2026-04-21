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
  openDoc(doc, line) {
    ipcRenderer.send("repolog:open-doc", { doc, line });
  },
  windowAction(action) {
    ipcRenderer.send("repolog:window-action", action);
  },
});
