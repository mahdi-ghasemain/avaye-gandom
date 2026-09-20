const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
const path = require('node:path')
const { createStore } = require('./store.cjs')
let store

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 620,
    title: 'آوای گندم',
    backgroundColor: '#f7f8f5',
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  window.loadFile(path.join(__dirname, '../dist/index.html'))
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  store = createStore(path.join(app.getPath('userData'), 'avaye-gandom.sqlite'))
  ipcMain.handle('store:getState', () => store.getState())
  ipcMain.handle('store:addProduct', (_event, input) => store.addProduct(input))
  ipcMain.handle('store:updateProduct', (_event, input) => store.updateProduct(input))
  ipcMain.handle('store:deleteProduct', (_event, input) => store.deleteProduct(input))
  ipcMain.handle('store:adjustStock', (_event, input) => store.adjustStock(input))
  ipcMain.handle('store:addSale', (_event, input) => store.addSale(input))
  ipcMain.handle('store:deleteSale', (_event, input) => store.deleteSale(input))
  ipcMain.handle('store:addExpense', (_event, input) => store.addExpense(input))
  ipcMain.handle('store:updateExpense', (_event, input) => store.updateExpense(input))
  ipcMain.handle('store:deleteExpense', (_event, input) => store.deleteExpense(input))
  ipcMain.handle('store:addBranch', (_event, input) => store.addBranch(input))
  ipcMain.handle('store:updateBranch', (_event, input) => store.updateBranch(input))
  ipcMain.handle('store:deleteBranch', (_event, input) => store.deleteBranch(input))
  ipcMain.handle('store:addFiscalYear', (_event, input) => store.addFiscalYear(input))
  ipcMain.handle('store:updateFiscalYear', (_event, input) => store.updateFiscalYear(input))
  ipcMain.handle('store:setFiscalYearClosed', (_event, input) => store.setFiscalYearClosed(input))
  ipcMain.handle('store:deleteFiscalYear', (_event, input) => store.deleteFiscalYear(input))
  ipcMain.handle('store:addPerson', (_event, input) => store.addPerson(input))
  ipcMain.handle('store:updatePerson', (_event, input) => store.updatePerson(input))
  ipcMain.handle('store:deletePerson', (_event, input) => store.deletePerson(input))
  ipcMain.handle('store:createInvoice', (_event, input) => store.createInvoice(input))
  ipcMain.handle('store:deleteInvoice', (_event, input) => store.deleteInvoice(input))
  ipcMain.handle('store:createStockVoucher', (_event, input) => store.createStockVoucher(input))
  ipcMain.handle('store:deleteStockVoucher', (_event, input) => store.deleteStockVoucher(input))
  ipcMain.handle('store:addCash', (_event, input) => store.addCash(input))
  ipcMain.handle('store:updateCash', (_event, input) => store.updateCash(input))
  ipcMain.handle('store:deleteCash', (_event, input) => store.deleteCash(input))
  ipcMain.handle('store:addCheque', (_event, input) => store.addCheque(input))
  ipcMain.handle('store:updateCheque', (_event, input) => store.updateCheque(input))
  ipcMain.handle('store:deleteCheque', (_event, input) => store.deleteCheque(input))
  ipcMain.handle('store:createJournal', (_event, input) => store.createJournal(input))
  ipcMain.handle('store:deleteJournal', (_event, input) => store.deleteJournal(input))
  ipcMain.handle('store:addEmployee', (_event, input) => store.addEmployee(input))
  ipcMain.handle('store:updateEmployee', (_event, input) => store.updateEmployee(input))
  ipcMain.handle('store:deleteEmployee', (_event, input) => store.deleteEmployee(input))
  ipcMain.handle('store:addPayroll', (_event, input) => store.addPayroll(input))
  ipcMain.handle('store:updatePayroll', (_event, input) => store.updatePayroll(input))
  ipcMain.handle('store:deletePayroll', (_event, input) => store.deletePayroll(input))
  ipcMain.handle('store:backup', async () => {
    const result = await dialog.showSaveDialog({ title: 'ذخیرهٔ نسخهٔ پشتیبان', defaultPath: `avaye-gandom-${new Date().toISOString().slice(0, 10)}.sqlite`, filters: [{ name: 'پشتیبان آوای گندم', extensions: ['sqlite'] }] })
    if (result.canceled || !result.filePath) return null
    return store.backupTo(result.filePath)
  })
  ipcMain.handle('store:restore', async () => {
    const result = await dialog.showOpenDialog({ title: 'بازگرداندن نسخهٔ پشتیبان', properties: ['openFile'], filters: [{ name: 'پشتیبان آوای گندم', extensions: ['sqlite'] }] })
    if (result.canceled || !result.filePaths[0]) return null
    const confirmation = await dialog.showMessageBox({ type: 'warning', buttons: ['انصراف', 'بازگرداندن'], defaultId: 0, cancelId: 0, title: 'بازگرداندن پشتیبان', message: 'اطلاعات فعلی با فایل پشتیبان جایگزین می‌شود. پیش از جایگزینی، یک نسخهٔ ایمنی خودکار ذخیره خواهد شد.' })
    if (confirmation.response !== 1) return null
    return store.restoreFrom(result.filePaths[0])
  })
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => { if (store) store.close() })
