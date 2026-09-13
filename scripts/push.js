'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const npmCli = process.env.npm_execpath;
const forbiddenPath = /(^|\/)(?:\.clasp\.json|\.env(?:\.[^/]*)?|desktop\.ini|node_modules|sheets|[^/]*\.(?:gsheet|pem|key)|(?:credentials|secrets?)[^/]*)($|\/)/i;

function invoke(program, args, capture) {
  const result = spawnSync(program, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    windowsHide: true,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit'
  });
  if (result.error) throw new Error('No se pudo ejecutar ' + program + ': ' + result.error.message);
  if (result.status !== 0) {
    const detail = capture ? String(result.stderr || '').trim() : '';
    throw new Error(program + ' terminó con código ' + result.status + (detail ? ': ' + detail : '.'));
  }
  return capture ? String(result.stdout || '') : '';
}

function git(args) {
  return invoke('git', args, true);
}

function npm(args) {
  if (!npmCli) throw new Error('Ejecuta este flujo mediante npm run push.');
  invoke(process.execPath, [npmCli].concat(args), false);
}

function pendingFiles() {
  return git(['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
    .split('\0').filter(Boolean);
}

function assertSafeFiles(files) {
  const unsafe = files.filter(function (filename) {
    return forbiddenPath.test(filename.replace(/\\/g, '/'));
  });
  if (unsafe.length) {
    throw new Error('Hay archivos sensibles que no se pueden confirmar: ' + unsafe.join(', '));
  }
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const messageArgs = args.filter(function (arg) { return arg !== '--dry-run'; });
  if (messageArgs.some(function (arg) { return arg.startsWith('--'); })) {
    throw new Error('Opción no reconocida. Usa --dry-run o un mensaje de commit.');
  }
  const message = messageArgs.join(' ').trim() ||
    String(process.env.COMMIT_MESSAGE || '').trim() || 'chore: sincroniza fuentes GAS';
  if (/[\r\n]/.test(message) || message.length > 200) {
    throw new Error('El mensaje de commit debe tener una sola línea y como máximo 200 caracteres.');
  }

  const root = path.resolve(git(['rev-parse', '--show-toplevel']).trim());
  if (root.toLowerCase() !== projectRoot.toLowerCase()) {
    throw new Error('Ejecuta npm run push desde la raíz de este repositorio.');
  }
  const branch = git(['symbolic-ref', '--quiet', '--short', 'HEAD']).trim();
  if (!branch) throw new Error('No hay una rama Git activa.');
  git(['remote', 'get-url', 'origin']);
  git(['config', 'user.name']);
  git(['config', 'user.email']);
  if (!fs.existsSync(path.join(projectRoot, '.clasp.json'))) {
    throw new Error('Falta .clasp.json: configura primero el proyecto Apps Script de destino.');
  }
  assertSafeFiles(pendingFiles());

  const beforeChecks = git(['status', '--porcelain', '--untracked-files=all']);
  console.log('Comprobando ESLint y tests...');
  npm(['run', 'check']);
  const afterChecks = git(['status', '--porcelain', '--untracked-files=all']);
  if (afterChecks !== beforeChecks) {
    throw new Error('El árbol cambió durante las comprobaciones; revisa los archivos y repite.');
  }
  if (dryRun) {
    console.log('Validación completa. No se ha creado un commit ni se ha enviado nada.');
    return;
  }

  const candidates = new Set(pendingFiles());
  assertSafeFiles(Array.from(candidates));
  invoke('git', ['add', '-A', '--', '.'], false);
  const staged = git(['diff', '--cached', '--name-only', '-z']).split('\0').filter(Boolean);
  assertSafeFiles(staged);
  if (staged.some(function (filename) { return !candidates.has(filename); })) {
    throw new Error('Aparecieron archivos nuevos durante el preparado del commit. Revisa el índice.');
  }
  invoke('git', ['diff', '--cached', '--check'], false);
  if (staged.length) {
    console.log('Confirmando ' + staged.length + ' archivos en Git...');
    invoke('git', ['commit', '-m', message], false);
  } else {
    console.log('No hay cambios nuevos que confirmar.');
  }
  if (git(['status', '--porcelain', '--untracked-files=all']).trim()) {
    throw new Error('El árbol no quedó limpio después del commit; no se enviará.');
  }

  console.log('Enviando la rama ' + branch + ' a origin...');
  invoke('git', ['push', '-u', 'origin', branch], false);
  console.log('Enviando fuentes a Apps Script con clasp...');
  npm(['run', 'clasp:push']);
  console.log('Fuentes enviadas. La versión desplegada de la web se actualiza por separado.');
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
