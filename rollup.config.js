// @ts-check
import path from 'path';
import ts from 'rollup-plugin-typescript2';
import json from '@rollup/plugin-json';

if (!process.env.TARGET) {
  throw new Error('TARGET package must be specified via --environment flag.');
}

const packagesDir = path.resolve(__dirname, 'packages');
const packageDir = path.resolve(packagesDir, process.env.TARGET);
const resolve = p => path.resolve(packageDir, p);
const pkg = require(resolve(`package.json`));

// ensure TS checks only once for each build
let hasTSChecked = false;

const packageConfigs = [createConfig()];

export default packageConfigs;

function createConfig() {
  const output = {
    file: resolve(`dist/index.js`),
    format: 'cjs'
  };
  const isCliPackage = pkg.name === '@frontbench/cli';

  if (isCliPackage) {
    output.file = resolve(`bin/frontbench.js`);
    output.banner = '#!/usr/bin/env node';
  }

  // output.exports = '' // TODO
  output.sourcemap = !!process.env.SOURCE_MAP;
  output.externalLiveBindings = false;

  const shouldEmitDeclarations = pkg.types && process.env.TYPES != null && !hasTSChecked;

  const tsPlugin = ts({
    check: process.env.NODE_ENV === 'production' && !hasTSChecked,
    tsconfig: path.resolve(__dirname, 'tsconfig.json'),
    cacheRoot: path.resolve(__dirname, 'node_modules/.rts2_cache'),
    tsconfigOverride: {
      compilerOptions: {
        sourceMap: output.sourcemap,
        declaration: shouldEmitDeclarations,
        declarationMap: shouldEmitDeclarations
      },
      exclude: ['**/__tests__', 'test-dts']
    }
  });

  // we only need to check TS and generate declarations once for each build.
  // it also seems to run into weird issues when checking multiple times
  // during a single build.
  hasTSChecked = true;

  const external = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
    ...['path']
  ];

  const nodePlugins = Object.keys(pkg.devDependencies || {}).length
    ? [
        // @ts-ignore
        require('@rollup/plugin-commonjs')({
          sourceMap: false,
          ignore: []
        }),
        require('@rollup/plugin-node-resolve').nodeResolve()
      ]
    : [];
  return {
    input: resolve('src/index.ts'),
    external,
    plugins: [
      json({
        // If true, instructs the plugin to generate a named export for every property of the JSON object.
        namedExports: false
      }),
      tsPlugin,
      ...nodePlugins
    ],
    output,
    onwarn: (msg, warn) => {
      if (!/Circular/.test(msg)) {
        warn(msg);
      }
    },
    treeshake: {
      moduleSideEffects: false
    }
  };
}
