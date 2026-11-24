// Cross-platform scheduler for `collect` (no always-on server).
// Usage: node scripts/schedule.mjs install|uninstall|status [--dry-run] [--platform=darwin|linux|win32]
// Interval: TT_INTERVAL_MIN (default 30).
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// Prefer the PATH shim (e.g. /opt/homebrew/bin/node) over the versioned Cellar path so upgrades don't break the job.
const NODE = (() => {
  if (process.platform === 'win32') return process.execPath;
  const r = spawnSync('/bin/sh', ['-c', 'command -v node'], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim().startsWith('/') ? r.stdout.trim() : process.execPath;
})();
const args = process.argv.slice(2);
const action = args.find((a) => !a.startsWith('--')) ?? 'status';
const DRY = args.includes('--dry-run');
const PLATFORM = (args.find((a) => a.startsWith('--platform=')) ?? '').split('=')[1] || process.platform;
const MIN = Math.max(1, Number(process.env.TT_INTERVAL_MIN ?? 30));
const NAME = 'token-tracker-collect';
const ENTRY = ['--disable-warning=ExperimentalWarning', 'server/cli-collect.ts'];

function run(cmd, a, input) {
  if (DRY) { console.log('[dry-run] $', cmd, a.join(' ')); return { status: 0, stdout: '' }; }
  const r = spawnSync(cmd, a, { input, encoding: 'utf8' });
  if (r.error) throw r.error;
  return r;
}
function write(path, content) {
  if (DRY) { console.log(`[dry-run] write ${path}:\n${content}\n`); return; }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

// ---------- macOS: launchd (catches up missed runs after sleep) ----------
const LABEL = 'com.hasan.token-tracker-collect';
const PLIST = join(homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const darwin = {
  install() {
    const log = join(homedir(), 'Library', 'Logs', `${NAME}.log`);
    // zsh -c cd: launchd's WorkingDirectory/log paths on external volumes fail with exit 78.
    const cmd = `cd "${ROOT}" && exec "${NODE}" ${ENTRY.join(' ')}`;
    write(PLIST, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key><array><string>/bin/zsh</string><string>-c</string><string>${xml(cmd)}</string></array>
  <key>StartInterval</key><integer>${MIN * 60}</integer>
  <key>RunAtLoad</key><true/>
  <key>LowPriorityIO</key><true/>
  <key>Nice</key><integer>10</integer>
  <key>StandardOutPath</key><string>${xml(log)}</string>
  <key>StandardErrorPath</key><string>${xml(log)}</string>
</dict></plist>
`);
    const uid = String(process.getuid?.() ?? '');
    run('launchctl', ['bootout', `gui/${uid}/${LABEL}`]);
    const r = run('launchctl', ['bootstrap', `gui/${uid}`, PLIST]);
    if (r.status) throw new Error('launchctl bootstrap failed: ' + r.stderr);
    console.log(`Installed launchd job ${LABEL} (every ${MIN} min). Log: ${log}`);
  },
  uninstall() {
    run('launchctl', ['bootout', `gui/${process.getuid?.()}/${LABEL}`]);
    if (!DRY) rmSync(PLIST, { force: true });
    console.log('Removed launchd job.');
  },
  status() {
    const r = run('launchctl', ['print', `gui/${process.getuid?.()}/${LABEL}`]);
    console.log(r.status ? 'Not installed.' : r.stdout.split('\n').filter((l) => /state =|last exit|run interval/.test(l)).join('\n'));
  },
};

// ---------- Linux: user crontab, tagged line ----------
const TAG = `# ${NAME}`;
const sq = (s) => `'${s.replace(/'/g, `'\\''`)}'`;
const cronExpr = MIN < 60 ? `*/${MIN} * * * *` : `0 */${Math.max(1, Math.round(MIN / 60))} * * *`;
function readCron() {
  if (DRY) return '';
  const r = spawnSync('crontab', ['-l'], { encoding: 'utf8' });
  if (r.error) throw new Error('crontab not found — install cron (e.g. sudo apt install cron)');
  return r.status === 0 ? r.stdout : '';
}
const stripTag = (t) => t.split('\n').filter((l) => l.trim() && !l.includes(TAG)).join('\n');
const linux = {
  install() {
    const logDir = join(process.env.XDG_STATE_HOME ?? join(homedir(), '.local', 'state'), 'token-tracker');
    if (!DRY) mkdirSync(logDir, { recursive: true });
    const line = `${cronExpr} cd ${sq(ROOT)} && ${sq(NODE)} ${ENTRY.join(' ')} >> ${sq(join(logDir, 'collect.log'))} 2>&1 ${TAG}`;
    const next = [stripTag(readCron()), line].filter(Boolean).join('\n') + '\n';
    const r = run('crontab', ['-'], next);
    if (r.status) throw new Error('crontab install failed: ' + r.stderr);
    console.log(`Installed cron job (${cronExpr}). Log: ${join(logDir, 'collect.log')}`);
    if (DRY) console.log('[dry-run] line:', line);
  },
  uninstall() {
    const rest = stripTag(readCron());
    run('crontab', ['-'], rest ? rest + '\n' : '');
    console.log('Removed cron job.');
  },
  status() {
    const l = readCron().split('\n').find((x) => x.includes(TAG));
    console.log(l ?? 'Not installed.');
  },
};

// ---------- Windows: Task Scheduler via PowerShell (hidden window, catches up missed runs) ----------
const TASK = 'TokenTrackerCollect';
const winDir = () => join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'token-tracker');
const ps = (script) => run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script]);
const psq = (s) => `'${s.replace(/'/g, "''")}'`;
const win32 = {
  install() {
    const dir = winDir();
    const log = join(dir, 'collect.log');
    const cmdFile = join(dir, 'collect.cmd');
    const vbsFile = join(dir, 'collect-hidden.vbs');
    write(cmdFile, `@echo off\r\ncd /d "${ROOT}"\r\n"${NODE}" ${ENTRY.join(' ')} >> "${log}" 2>&1\r\n`);
    // wscript runs the .cmd with no console window flashing every 30 min.
    write(vbsFile, `CreateObject("WScript.Shell").Run """${cmdFile}""", 0, True\r\n`);
    const r = ps([
      `$a = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument ${psq(`"${vbsFile}"`)}`,
      `$t = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes ${MIN})`,
      `$s = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 10)`,
      `Register-ScheduledTask -TaskName ${psq(TASK)} -Action $a -Trigger $t -Settings $s -Description 'Token Tracker usage snapshot' -Force | Out-Null`,
    ].join('; '));
    if (r.status) throw new Error('Register-ScheduledTask failed: ' + r.stderr);
    console.log(`Installed scheduled task ${TASK} (every ${MIN} min). Log: ${log}`);
  },
  uninstall() {
    ps(`Unregister-ScheduledTask -TaskName ${psq(TASK)} -Confirm:$false -ErrorAction SilentlyContinue`);
    if (!DRY) rmSync(winDir(), { recursive: true, force: true });
    console.log('Removed scheduled task.');
  },
  status() {
    const r = ps(`Get-ScheduledTaskInfo -TaskName ${psq(TASK)} | Format-List LastRunTime,LastTaskResult,NextRunTime`);
    console.log(r.status ? 'Not installed.' : r.stdout.trim());
  },
};

const impl = { darwin, linux, win32 }[PLATFORM];
if (!impl || !impl[action]) {
  console.error(`Usage: node scripts/schedule.mjs install|uninstall|status  (platform ${PLATFORM} ${impl ? '' : 'unsupported'})`);
  process.exit(1);
}
try { impl[action](); } catch (e) { console.error('✗', e.message); process.exit(1); }
