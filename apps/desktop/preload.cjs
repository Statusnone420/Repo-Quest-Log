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
  firstRunCheck() {
    return ipcRenderer.invoke("repolog:first-run-check");
  },
  dismissWizard() {
    return ipcRenderer.invoke("repolog:wizard-dismiss");
  },
  initTemplate(target, force) {
    return ipcRenderer.invoke("repolog:init-template", { target, force });
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
  runTuneup() {
    return ipcRenderer.invoke("repolog:run-tuneup");
  },
  writeConfig(payload) {
    return ipcRenderer.invoke("repolog:write-config", payload);
  },
  writeTuneupCharter(charter) {
    return ipcRenderer.invoke("repolog:write-tuneup-charter", charter);
  },
  copyStandup() {
    return ipcRenderer.invoke("repolog:copy-standup");
  },
  windowAction(action) {
    ipcRenderer.send("repolog:window-action", action);
  },
});
