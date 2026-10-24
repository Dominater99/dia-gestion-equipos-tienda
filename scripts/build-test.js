'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const environmentDeclaration = "const EXECUTION_CONFIG = Object.freeze({ mode: 'PROD', testEmail: '' });";

function validateTestConfig(config) {
  if (!config || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(config.testEmail || '')) {
    throw new Error('Configura un único testEmail válido en .test-environment.json.');
  }
  if (!config.productionDeploymentId || !Number.isSafeInteger(config.productionVersion) ||
      config.productionVersion < 1) {
    throw new Error('Falta identificar la implementación y versión de producción que se deben conservar.');
  }
  if (config.testDeploymentId && config.testDeploymentId === config.productionDeploymentId) {
    throw new Error('Los destinos de pruebas y producción deben ser distintos.');
  }
  return config;
}

function renderTestEnvironment(source, testEmail) {
  if (source.split(environmentDeclaration).length !== 2) {
    throw new Error('No se reconoce la declaración canónica del entorno; no se genera el paquete.');
  }
  return source.replace(environmentDeclaration,
    'const EXECUTION_CONFIG = Object.freeze(' + JSON.stringify({ mode: 'TEST', testEmail: testEmail }) + ');');
}

function buildTestPackage(config) {
  validateTestConfig(config);
  const claspConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, '.clasp.json'), 'utf8'));
  if (!claspConfig.scriptId) throw new Error('Falta el proyecto Apps Script de destino.');
  const stagingRoot = path.join(projectRoot, '.staging');
  fs.mkdirSync(stagingRoot, { recursive: true });
  const buildDir = fs.mkdtempSync(path.join(stagingRoot, 'test-'));
  const sourceDir = path.join(buildDir, 'src');
  fs.cpSync(path.join(projectRoot, 'src'), sourceDir, { recursive: true });
  const environmentFile = path.join(sourceDir, 'backend', '01_environment.js');
  fs.writeFileSync(environmentFile, renderTestEnvironment(
    fs.readFileSync(environmentFile, 'utf8'), config.testEmail
  ));
  fs.writeFileSync(path.join(buildDir, '.clasp.json'), JSON.stringify({
    scriptId: claspConfig.scriptId, rootDir: 'src'
  }, null, 2) + '\n');
  fs.copyFileSync(path.join(projectRoot, '.claspignore'), path.join(buildDir, '.claspignore'));
  return buildDir;
}

function readTestConfig() {
  return validateTestConfig(JSON.parse(fs.readFileSync(path.join(projectRoot, '.test-environment.json'), 'utf8')));
}

if (require.main === module) {
  try {
    console.log('Paquete local TEST generado en ' + buildTestPackage(readTestConfig()));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { validateTestConfig, renderTestEnvironment, buildTestPackage, readTestConfig };
