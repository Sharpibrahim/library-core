import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Detect if we are running inside Electron
const isElectron = typeof process !== 'undefined' && !!(process.versions && process.versions.electron);

if (isElectron) {
  // --- ELECTRON DESKTOP WRAPPER APPLICATION ---
  const { app, BrowserWindow, shell, dialog } = await import('electron');
  
  let serverProcess = null;
  let mainWindow = null;
  const PORT = process.env.PORT || 3000;
  const prodBundlePath = path.join(__dirname, 'dist-server', 'server.js');
  
  console.log('====================================================');
  console.log('   LibraryCore Desktop Launcher - Electron Mode     ');
  console.log('====================================================');
  
  function startBackendServer() {
    console.log('[Electron/Backend] Booting local databases & Academic core server...');
    
    let command = 'npx';
    let args = ['tsx', 'server.ts'];
    
    if (fs.existsSync(prodBundlePath)) {
      console.log('[Electron/Backend] Production bundle detected. Initializing standard compiled environment...');
      command = 'node';
      args = [prodBundlePath];
    } else {
      console.log('[Electron/Backend] Working in active workspace. Invoking TypeScript compiler...');
    }
    
    // Spawn server as independent subprocess using system Node runtimes to avoid
    // V8 ABI binary mismatches with Electron native bindings (e.g. better-sqlite3)
    serverProcess = spawn(command, args, {
      cwd: __dirname,
      shell: true,
      env: {
        ...process.env,
        NODE_ENV: fs.existsSync(prodBundlePath) ? 'production' : 'development',
        PORT: PORT.toString()
      }
    });
    
    serverProcess.stdout.on('data', (data) => {
      const message = data.toString().trim();
      console.log(`[Server]: ${message}`);
    });
    
    serverProcess.stderr.on('data', (data) => {
      const message = data.toString().trim();
      console.warn(`[Server Error]: ${message}`);
    });
    
    serverProcess.on('close', (code) => {
      console.log(`[Electron/Backend] API service closed with code: ${code}`);
      if (code !== 0 && code !== null && !app.isQuitting) {
        dialog.showErrorBox(
          'Academic Platform Offline',
          `The LibraryCore database microservice closed unexpectedly with exit code ${code}.\n\nPlease restart the application.`
        );
      }
    });
  }
  
  function createMainWindow() {
    mainWindow = new BrowserWindow({
      width: 1300,
      height: 850,
      minWidth: 1024,
      minHeight: 700,
      title: "LibraryCore - Elite Academic Library Ecosystem",
      show: false, // Hide initial visual window frame until backend is fully online
      backgroundColor: '#f8fafc',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });
    
    mainWindow.loadURL(`http://localhost:${PORT}`);
    
    // Prevent screen flashing by delaying show until loaded
    mainWindow.once('ready-to-show', () => {
      if (mainWindow) {
        mainWindow.show();
      }
    });
    
    // Route any external resource links securely to native standard system browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('http:') || url.startsWith('https:')) {
        shell.openExternal(url);
      }
      return { action: 'deny' };
    });
    
    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }
  
  // App activation hooks
  app.whenReady().then(() => {
    // 1. Spin up background local SQLite & Express system
    startBackendServer();
    
    // 2. Allow database configuration and Express to bind to port 3000
    setTimeout(() => {
      createMainWindow();
    }, 1800);
    
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });
  
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
  
  app.on('before-quit', () => {
    app.isQuitting = true;
    if (serverProcess) {
      console.log('[Electron/Lifecycle] Safely shutting down active database sub-processes...');
      serverProcess.kill('SIGTERM');
    }
  });

} else {
  // --- STANDARD HEADLESS CLOUD RUN / CONTAINER RUNTIME LAUNCHER ---
  const prodBundlePath = path.join(__dirname, 'dist-server', 'server.js');
  const prodStaticPath = path.join(__dirname, 'dist');
  
  console.log('====================================================');
  console.log('   LibraryCore - Elite Academic Library Ecosystem  ');
  console.log('====================================================');
  console.log(`[Launcher] Boot Time: ${new Date().toISOString()}`);
  console.log(`[Launcher] Absolute Root Path: ${__dirname}`);
  
  if (fs.existsSync(prodBundlePath)) {
    console.log('[Launcher] Detection Status: PRODUCTION BUNDLE FOUND (dist-server/server.js)');
    process.env.NODE_ENV = process.env.NODE_ENV || 'production';
    
    if (!fs.existsSync(prodStaticPath)) {
      console.warn('[Launcher] ⚠️ Warning: Frontend dist/ folder not found. Static views may fail to load correctly.');
    }
  
    console.log(`[Launcher] Invoking bundled production engine under Node ${process.version}...`);
    console.log('----------------------------------------------------');
    
    await import('./dist-server/server.js');
  } else {
    console.log('[Launcher] Detection Status: PRODUCTION BUNDLE NOT FOUND');
    console.log('[Launcher] Defaulting to Development/Transpile Mode...');
    console.log('[Launcher] Bootstrapping TSX compiler runner (server.ts)...');
    console.log('----------------------------------------------------');
  
    const tsExecute = spawn('npx', ['tsx', 'server.ts'], {
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'development'
      }
    });
  
    const handleSignal = (signal) => {
      console.log(`[Launcher] Received system signal: ${signal}. Forwarding to server process...`);
      tsExecute.kill(signal);
    };
  
    process.on('SIGTERM', () => handleSignal('SIGTERM'));
    process.on('SIGINT', () => handleSignal('SIGINT'));
  
    tsExecute.on('close', (code) => {
      console.log(`[Launcher] Server child process terminated (Exit Code: ${code || 0})`);
      process.exit(code || 0);
    });
  
    tsExecute.on('error', (err) => {
      console.error('[Launcher] ❌ Error occurred while starting dev process:', err);
      process.exit(1);
    });
  }
}
