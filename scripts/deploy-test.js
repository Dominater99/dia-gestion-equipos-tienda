'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildTestPackage, readTestConfig } = require('./build-test');

const projectRoot = path.resolve(__dirname, '..');
const claspProgram = path.join(projectRoot, 'node_modules', '@google', 'clasp', 'build', 'src', 'index.js');
const testDescription = 'TEST EquiposTienda';

function invoke(program, args, capture) {
  const result = spawnSync(program, args, {
    cwd: projectRoot, encoding: 'utf8', windowsHide: true,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error('El comando terminó con error. ' + (capture ? result.stderr || result.stdout : ''));
  }
  return result.stdout || '';
}

function assertDeploymentTargets(deployments, config) {
  const production = deployments.find(function (deployment) {
    return deployment.deploymentId === config.productionDeploymentId;
  });
  if (!production || production.versionNumber !== config.productionVersion) {
    throw new Error('La versión de producción no coincide con la registrada; revisa el destino antes de enviar fuentes.');
  }
  if (config.testDeploymentId) {
    const testing = deployments.find(function (deployment) {
      return deployment.deploymentId === config.testDeploymentId;
    });
    if (!testing || testing.deploymentId === production.deploymentId ||
        !String(testing.description || '').startsWith(testDescription)) {
      throw new Error('El destino configurado no está identificado como implementación de pruebas.');
    }
  }
}

function assertUnchangedDeployments(before, after, testDeploymentId) {
  before.filter(function (deployment) {
    return deployment.versionNumber && deployment.deploymentId !== testDeploymentId;
  }).forEach(function (deployment) {
    const observed = after.find(function (entry) { return entry.deploymentId === deployment.deploymentId; });
    if (!observed || observed.versionNumber !== deployment.versionNumber) {
      throw new Error('Una implementación ajena a pruebas ha cambiado; revisa el estado remoto.');
    }
  });
}

function main() {
  const args = process.argv.slice(2);
  if (args.some(function (arg) { return !['--dry-run', '--stage-only'].includes(arg); })) {
    throw new Error('Usa deploy:test, --dry-run o --stage-only.');
  }
  const dryRun = args.includes('--dry-run');
  const stageOnly = args.includes('--stage-only');
  if (dryRun && stageOnly) throw new Error('Elige --dry-run o --stage-only, no ambos.');
  const config = readTestConfig();
  if (config.pendingTestVersion && !dryRun && !stageOnly) {
    throw new Error('Hay una publicación de pruebas con resultado pendiente. Revisa los despliegues antes de reintentar.');
  }
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error('Ejecuta mediante npm run deploy:test.');
  invoke(process.execPath, [npmCli, 'run', 'check'], false);
  const buildDir = buildTestPackage(config);
  if (dryRun) {
    console.log('Paquete TEST validado localmente. No se ha consultado ni modificado Google.');
    return;
  }
  function clasp(args, json) {
    const output = invoke(process.execPath,
      [claspProgram, '-P', path.join(buildDir, '.clasp.json')].concat(json ? ['--json'] : [], args), true);
    return json ? JSON.parse(output) : output;
  }
  const before = clasp(['deployments'], true);
  assertDeploymentTargets(before, config);
  if (stageOnly && config.pendingTestVersion && before.some(function (deployment) {
    return deployment.versionNumber === config.pendingTestVersion;
  })) {
    throw new Error('La versión pendiente ya está desplegada. Identifica primero esa implementación de pruebas.');
  }
  // Este flujo no hace commits ni git push y nunca elige producción automáticamente.
  console.log('Enviando únicamente el paquete TEST al código actual del proyecto...');
  clasp(['push', '--force'], false);
  const description = testDescription + ' · ' + new Date().toISOString();
  const version = clasp(['version', description], true);
  if (!Number.isSafeInteger(version.versionNumber)) throw new Error('No se recibió una versión válida.');
  if (stageOnly) {
    config.stagedTestVersion = version.versionNumber;
    delete config.pendingTestVersion;
    fs.writeFileSync(path.join(projectRoot, '.test-environment.json'), JSON.stringify(config, null, 2) + '\n');
    assertUnchangedDeployments(before, clasp(['deployments'], true), config.testDeploymentId);
    console.log('Versión TEST ' + version.versionNumber + ' preparada. No se ha creado ni actualizado ningún despliegue.');
    return;
  }
  // Se conserva antes de publicar para poder recuperar un resultado de red incierto.
  config.pendingTestVersion = version.versionNumber;
  fs.writeFileSync(path.join(projectRoot, '.test-environment.json'), JSON.stringify(config, null, 2) + '\n');
  const deployArgs = ['deploy', '-V', String(version.versionNumber), '-d', description];
  if (config.testDeploymentId) deployArgs.push('-i', config.testDeploymentId);
  const testing = clasp(deployArgs, true);
  if (!testing.deploymentId || testing.deploymentId === config.productionDeploymentId) {
    throw new Error('La respuesta no identifica una implementación independiente de pruebas.');
  }
  config.testDeploymentId = testing.deploymentId;
  delete config.pendingTestVersion;
  fs.writeFileSync(path.join(projectRoot, '.test-environment.json'), JSON.stringify(config, null, 2) + '\n');
  const after = clasp(['deployments'], true);
  assertUnchangedDeployments(before, after, testing.deploymentId);
  const verified = after.find(function (deployment) { return deployment.deploymentId === testing.deploymentId; });
  if (!verified || verified.versionNumber !== version.versionNumber) {
    throw new Error('No se pudo verificar la versión publicada de pruebas.');
  }
  console.log('Pruebas publicadas en versión ' + version.versionNumber + '. Producción conserva su versión.');
  console.log('https://script.google.com/macros/s/' + testing.deploymentId + '/exec');
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { assertDeploymentTargets, assertUnchangedDeployments };
