#!/usr/bin/env node

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { generate } from '@internal/utils/api-builder.js';

const argv = yargs(hideBin(process.argv))
    .option('target', { type: 'string', required: true })
    .option('entry', { type: 'string', required: true, array: true })
    .argv;
generate(argv.target, argv.entry);
