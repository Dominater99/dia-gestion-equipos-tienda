'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const npmCli = process.env.npm_execpath;
const claspProgram = process.platform === 'win32'
  ? path.join(projectRoot, 'node_modules', '.bin', 'clasp.cmd')
  : path.join(projectRoot, 'node_modules', '.bin', 'clasp');

function invoke(program, args, capture) {
  const result = spawnSync(program, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    windowsHide: true,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit'
  });
  if (result.error) throw new Error('No se pudo ejecutar ' + program + ': ' + result.error.message);
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(program + ' terminó con código ' + result.status + (detail ? ':\n' + detail : '.'));
  }
  return capture ? String(result.stdout || '') : '';
}

function npm(args) {
  if (!npmCli) throw new Error('Ejecuta este flujo mediante npm run deploy.');
  invoke(process.execPath, [npmCli].concat(args), false);
}

function parseActiveDeployment(output) {
  const deployments = String(output).split(/\r?\n/).map(function (line) {
    const match = line.match(/^\s*-\s+(\S+)\s+@(\d+)(?:\s+-\s+.*)?$/);
    return match ? { id: match[1], version: Number(match[2]) } : null;
  }).filter(Boolean);
  if (deployments.length !== 1) {
    throw new Error('Se esperaba exactamente una implementación versionada. Revisa "clasp deployments" antes de desplegar.');
  }
  return deployments[0];
}

function parseVersion(output) {
  const match = String(output).match(/Created version\s+(\d+)/i);
  if (!match) throw new Error('clasp no devolvió la versión creada.');
  return Number(match[1]);
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const descriptionParts = args.filter(function (arg) { return arg !== '--dry-run'; });
  if (descriptionParts.some(function (arg) { return arg.startsWith('--'); })) {
    throw new Error('Opción no reconocida. Usa --dry-run o una descripción de una línea.');
  }
  const description = descriptionParts.join(' ').trim() || 'Actualiza implementación web';
  if (/[\r\n]/.test(description) || description.length > 200) {
    throw new Error('La descripción debe tener una sola línea y como máximo 200 caracteres.');
  }

  npm(['run', 'push'].concat(dryRun ? ['--', '--dry-run'] : []));
  if (dryRun) {
    console.log('Validación completa. No se creó una versión ni se actualizó la implementación.');
    return;
  }

  const activeDeployment = parseActiveDeployment(invoke(process.execPath, [claspProgram, 'deployments'], true));
  console.log('Creando una versión de Apps Script...');
  const version = parseVersion(invoke(process.execPath, [claspProgram, 'version', description], true));
  console.log('Actualizando la implementación ' + activeDeployment.id + ' a la versión ' + version + '...');
  invoke(process.execPath, [claspProgram, 'deploy', '-i', activeDeployment.id, '-V', String(version), '-d', description], false);
  console.log('Implementación actualizada a la versión ' + version + '.');
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
