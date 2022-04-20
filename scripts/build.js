// @ts-check
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const execa = require('execa');
const { gzipSync } = require('zlib');
const { compress } = require('brotli');
const { targets: allTargets, fuzzyMatchTarget } = require('./utils');

const args = require('minimist')(process.argv.slice(2));
const targets = args._;
const sourceMap = args.sourcemap || args.s;
const buildAllMatching = args.all || args.a;
const buildTypes = args.t || args.types;
const commit = execa.sync('git', ['rev-parse', 'HEAD']).stdout.slice(0, 7);

run();

async function run() {
  // remove build cache for release builds to avoid outdated enum values
  await fs.remove(path.resolve(__dirname, '../node_modules/.rts2_cache'));
  if (!targets.length) {
    await buildAll(allTargets);
    checkAllSizes(allTargets);
  } else {
    await buildAll(fuzzyMatchTarget(targets, buildAllMatching));
    checkAllSizes(fuzzyMatchTarget(targets, buildAllMatching));
  }
}

async function buildAll(targets) {
  await runParallel(require('os').cpus().length, targets, build);
}

async function runParallel(maxConcurrency, source, iteratorFn) {
  const ret = [];
  const executing = [];
  for (const item of source) {
    const p = Promise.resolve().then(() => iteratorFn(item, source));
    ret.push(p);

    if (maxConcurrency <= source.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= maxConcurrency) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(ret);
}

async function build(target) {
  const pkgDir = path.resolve(`packages/${target}`);
  const pkg = require(`${pkgDir}/package.json`);
  // if this is a full build (no specific targets), ignore private packages
  if (!targets.length && pkg.private) {
    return;
  }
  await execa(
    'rollup',
    [
      '-c',
      '--environment',
      [
        `COMMIT:${commit}`,
        `TARGET:${target}`,
        sourceMap ? `SOURCE_MAP:true` : ``,
        buildTypes ? `TYPES:true` : ``
      ]
        .filter(Boolean)
        .join(',')
    ],
    {
      stdio: 'inherit'
    }
  );
  if (buildTypes && pkg.types) {
    console.log();
    console.log(chalk.bold(chalk.yellow(`Rolling up type definitions for ${target}...`)));

    // build types
    const { Extractor, ExtractorConfig } = require('@microsoft/api-extractor');

    const extractorConfigPath = path.resolve(pkgDir, `api-extractor.json`);
    const extractorConfig = ExtractorConfig.loadFileAndPrepare(extractorConfigPath);
    const extractorResult = Extractor.invoke(extractorConfig, {
      localBuild: true,
      showVerboseMessages: true
    });
    if (extractorResult.succeeded) {
      // concat additional d.ts to rolled-up dts
      const typesDir = path.resolve(pkgDir, 'types');
      if (fs.existsSync(typesDir)) {
        const dtsPath = path.resolve(pkgDir, pkg.types);
        const existing = await fs.readFile(dtsPath, 'utf-8');
        const typeFiles = await fs.readdir(typesDir);
        const toAdd = await Promise.all(
          typeFiles.map(file => {
            return fs.readFile(path.resolve(typesDir, file), 'utf-8');
          })
        );
        await fs.writeFile(dtsPath, existing + '\n' + toAdd.join('\n'));
      }
      console.log(chalk.bold(chalk.green(`API Extractor completed successfully.`)));
    } else {
      console.error(
        `API Extractor completed with ${extractorResult.errorCount} errors` +
          ` and ${extractorResult.warningCount} warnings`
      );
      process.exitCode = 1;
    }
    await fs.remove(`${pkgDir}/dist/packages`);
  }
}

function checkAllSizes(targets) {
  for (const target of targets) {
    checkSize(target);
  }
  console.log();
}

function checkSize(target) {
  const pkgDir = path.resolve(`packages/${target}`);
  const isCliPackage = target === 'cli';
  if (isCliPackage) {
    return;
  }
  checkFileSize(`${pkgDir}/dist/index.js`);
}

function checkFileSize(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const file = fs.readFileSync(filePath);
  const minSize = (file.length / 1024).toFixed(2) + 'kb';
  const gzipped = gzipSync(file);
  const gzippedSize = (gzipped.length / 1024).toFixed(2) + 'kb';
  const compressed = compress(file);
  const compressedSize = (compressed.length / 1024).toFixed(2) + 'kb';
  console.log(
    `${chalk.gray(
      chalk.bold(path.basename(filePath))
    )} min:${minSize} / gzip:${gzippedSize} / brotli:${compressedSize}`
  );
}
