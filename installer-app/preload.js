const { contextBridge } = require("electron");
const { ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("installerAPI", {
  getDefaultPath: () => ipcRenderer.invoke("get-default-path"),
  selectDir: () => ipcRenderer.invoke("select-dir"),
  installNode: () => ipcRenderer.invoke("install-node"),
  installGit: () => ipcRenderer.invoke("install-git"),
  doInstall: (opts) => ipcRenderer.invoke("do-install", opts),
  quit: () => ipcRenderer.invoke("quit"),
  openGitHubTokenUrl: () => ipcRenderer.invoke("open-github-token-url"),
  githubGetUser: (token) => ipcRenderer.invoke("github-get-user", token),
  cleanupRunningProcesses: () => ipcRenderer.invoke("cleanup-running-processes"),
});
