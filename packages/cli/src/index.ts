import { chalk } from '@frontbench/cli-shared-utils';

console.log(chalk.red('You are using [front-workbench]'));

import { program } from 'commander';
import pkg from '../package.json';

program.version(`${pkg.name} ${pkg.version}`).usage('<command> [options]');
