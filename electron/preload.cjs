const { contextBridge, ipcRenderer } = require('electron');

const noirAPI = {
  // Window Controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onMaximizedChange: (callback) => {
    const sub = (_, val) => callback(val);
    ipcRenderer.on('window:maximizedChanged', sub);
    return () => ipcRenderer.removeListener('window:maximizedChanged', sub);
  },

  // Tabs management
  createTab: (url, spaceId, pinned) => ipcRenderer.invoke('tab:create', { url, spaceId, pinned }),
  switchTab: (id) => ipcRenderer.invoke('tab:switch', id),
  closeTab: (id) => ipcRenderer.invoke('tab:close', id),
  navigateTab: (id, url) => ipcRenderer.invoke('tab:navigate', { id, url }),
  goBack: (id) => ipcRenderer.invoke('tab:goBack', id),
  goForward: (id) => ipcRenderer.invoke('tab:goForward', id),
  reloadTab: (id) => ipcRenderer.invoke('tab:reload', id),

  // Layout & Visibility
  setLayout: (layout) => ipcRenderer.send('layout:update', layout),
  setViewVisible: (visible) => ipcRenderer.send('view:setVisible', visible),

  // Adblocker
  getAdblockStats: () => ipcRenderer.invoke('adblock:getStats'),
  toggleAdblock: (enabled) => ipcRenderer.invoke('adblock:toggle', enabled),
  onAdblockCount: (callback) => {
    const sub = (_, count) => callback(count);
    ipcRenderer.on('adblock:count', sub);
    return () => ipcRenderer.removeListener('adblock:count', sub);
  },

  // Events
  onTabUpdated: (callback) => {
    const sub = (_, tab) => callback(tab);
    ipcRenderer.on('tab:updated', sub);
    return () => ipcRenderer.removeListener('tab:updated', sub);
  },
  onTabActivated: (callback) => {
    const sub = (_, tabId) => callback(tabId);
    ipcRenderer.on('tab:activated', sub);
    return () => ipcRenderer.removeListener('tab:activated', sub);
  },
  onTabClosed: (callback) => {
    const sub = (_, tabId) => callback(tabId);
    ipcRenderer.on('tab:closed', sub);
    return () => ipcRenderer.removeListener('tab:closed', sub);
  },
  onShortcut: (shortcut, callback) => {
    const sub = (_, ...args) => callback(...args);
    ipcRenderer.on(shortcut, sub);
    return () => ipcRenderer.removeListener(shortcut, sub);
  }
};

contextBridge.exposeInMainWorld('noirAPI', noirAPI);
