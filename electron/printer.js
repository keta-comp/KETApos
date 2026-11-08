// Electron tomonidan termal printerga chiqish: COM port (PowerShell), faylga
// saqlash va WebUSB uchun qurilma tanlovini o'zi bajarish.
//
// COM portga yozish uchun tayyor modul (serialport) o'rniga Windows'dagi
// PowerShell ishlatiladi: ilova .exe ichiga native bina qo'shish talab qilinmaydi.

const { execFile } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { BrowserWindow, session } = require('electron');

const PORT_READ = `
$names = [System.IO.Ports.SerialPort]::GetPortNames()
foreach ($n in $names) { Write-Output $n }
`;

const PORT_WRITE = `
try {
  $job = Get-Content -LiteralPath $env:POS_PRINT_JOB -Raw -Encoding UTF8 | ConvertFrom-Json
  $port = New-Object System.IO.Ports.SerialPort ($job.Port, $job.Baud, 'None', 8, 'One')
  $port.WriteTimeout = 15000
  $port.Open()
  $bytes = [System.IO.File]::ReadAllBytes($job.Data)
  $port.Write($bytes, 0, $bytes.Length)
  Start-Sleep -Milliseconds 300
  $port.Close()
  Write-Output 'OK'
} catch {
  Write-Output ('ERR:' + $_.Exception.Message)
}
`;

// PowerShell xabari tilda keladi — kassirga tushunarli javob qaytaramiz.
function explainSerialError(message) {
  const text = String(message || '');
  if (/denied|\u0434\u043e\u0441\u0442\u0443\u043f|\u043e\u0442\u043a\u0430\u0437/i.test(text)) {
    return 'Port band: uni boshka dastur ochib qo\'yg\'an. O\'sha dasturni yoping.';
  }
  if (/not found|does not exist|exist|\u043d\u0430\u0439\u0434\u0435\u043d|\u0441\u0443\u0449\u0435\u0441\u0442\u0432/i.test(text)) {
    return 'Bunday COM port topilmadi. Ro\'yxatni yangilab, portni qayta tanlang.';
  }
  if (/timeout|\u0442\u0430\u0439\u043c\u0430\u0443\u0442|\u0437\u0430\u043a\u043e\u043d\u0447\u0438\u043b\u0441\u044f/i.test(text)) {
    return 'Printer javob bermadi: u yoqilganmi va kabel ulanganmi tekshiring.';
  }
  return text || 'COM portga yozib bo\'lmadi.';
}

// Skript matniga hech qanday foydalanuvchi qiymati kiritilmaydi: port, tezlik
// va ma'lumot fayli muhit o'zgaruvchisi orqali beriladigan JSON'da o'qiladi.
function runPowerShell(script, data) {
  return new Promise((resolve) => {
    let dir = null;
    try {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-print-'));
      const jobFile = path.join(dir, 'job.json');
      const psFile = path.join(dir, 'run.ps1');
      fs.writeFileSync(jobFile, JSON.stringify(data), 'utf8');
      // Stop: xato bo'lsa skript darhol to'xtaydi. UTF-8: aks holda Windows
      // konsoli xabarlarni mahalliy kodlashga (cp866) o'girib, o'qib bo'lmaydigan qiladi.
      const body = [
        '$ErrorActionPreference = \'Stop\'',
        '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
        script.replace(/^\n/, ''),
      ].join('\r\n');
      // BOM shart: Windows PowerShell BOM'siz faylni mahalliy kodlashda o'qiydi.
      fs.writeFileSync(psFile, '\uFEFF' + body, 'utf8');
      execFile(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', psFile],
        { timeout: 25000, windowsHide: true, env: { ...process.env, POS_PRINT_JOB: jobFile } },
        (error, stdout, stderr) => {
          fs.rmSync(dir, { recursive: true, force: true });
          resolve({
            ok: !error,
            stdout: String(stdout || '').trim(),
            error: error ? String(stderr || error.message).trim() : '',
          });
        },
      );
    } catch (e) {
      if (dir) fs.rmSync(dir, { recursive: true, force: true });
      resolve({ ok: false, stdout: '', error: e.message });
    }
  });
}

function registerSerialIpc(ipcMain) {
  let portCache = null;
  const readPorts = () => {
    if (process.platform !== 'win32') return Promise.resolve([]);
    if (portCache && Date.now() - portCache.at < 5000) return portCache.promise;
    const promise = runPowerShell(PORT_READ, {}).then((res) => (res.ok
      ? res.stdout.split(/\r?\n/).filter(Boolean).map((name) => ({ path: name, label: name }))
      : []));
    // Bir necha so'rov bitta PowerShell jarayonini ishga tushirmasligi uchun
    // javobni qisqa vaqt saqlaymiz (sozlamalar oynasi portlarni tez-tez so'raydi).
    portCache = { at: Date.now(), promise };
    return promise;
  };

  ipcMain.handle('printer:serial-ports', readPorts);
  ipcMain.handle('printer:serial-refresh', () => {
    portCache = null;
    return readPorts();
  });

  ipcMain.handle('printer:serial-write', async (_e, { port, baudRate, bytes }) => {
    if (process.platform !== 'win32') {
      return { ok: false, error: 'COM portga chiqish hozircha Windows\'da ishlaydi.' };
    }
    if (!port) return { ok: false, error: 'COM port tanlanmagan.' };
    if (!/^com\d{1,3}$/i.test(String(port))) {
      return { ok: false, error: 'COM port nomi noto\'g\'ri.' };
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pos-print-'));
    const dataFile = path.join(dir, 'ticket.bin');
    try {
      fs.writeFileSync(dataFile, Buffer.from(bytes));
      const res = await runPowerShell(PORT_WRITE, { Port: String(port).toUpperCase(), Baud: Number(baudRate) || 9600, Data: dataFile });
      const failure = res.stdout.split(/\r?\n/).find((line) => line.startsWith('ERR:'));
      if (failure || !res.ok) {
        return { ok: false, error: explainSerialError(failure ? failure.slice(4) : res.error) };
      }
      return { ok: true, port: String(port).toUpperCase() };
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
}

function registerFileIpc(ipcMain, dialog) {
  ipcMain.handle('printer:save-file', async (_e, { name, bytes }) => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showSaveDialog(win || undefined, {
      title: 'Chek faylini saqlash',
      defaultPath: String(name || 'chek.bin').replace(/[\\/:*?"<>|]/g, '_'),
      filters: [{ name: 'ESC/POS', extensions: ['bin'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false, cancelled: true };
    try {
      fs.writeFileSync(result.filePath, Buffer.from(bytes));
      return { ok: true, path: result.filePath };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
}

// WebUSB/Web Serial Chromium API'lari Electron'da ham ishlaydi, lekin qurilma
// tanlovini ilova o'zi bajarishi kerak (brauzerdagidek ro'yxat oynasi yo'q).
function registerDeviceSelection(app) {
  app.on('select-usb-device', (event, details, callback) => {
    event.preventDefault();
    // deviceList requestDevice()ga berilgan filtrlar bilan qisqartirilgan
    // bo'ladi — shuning uchun ro'yxatdagi birinchi qurilma kerakli printer.
    const list = details.deviceList || [];
    callback(list.length ? list[0].deviceId : '');
  });

  app.on('select-serial-port', (event, portList, callback) => {
    event.preventDefault();
    callback(portList && portList.length ? portList[0].path : '');
  });

  // Kassa — printer bilan ishlaydigan maxsus dastur: har chop etishda ruxsat
  // so'rash o'rniga bir marta tanlangan qurilmaga doim yo'l ochiq.
  session.defaultSession.setDevicePermissionHandler(() => true);
}

module.exports = { registerSerialIpc, registerFileIpc, registerDeviceSelection };
