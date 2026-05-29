#!/usr/bin/env node

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import { build } from '@internal/utils/builder.js';

const argv = yargs(hideBin(process.argv))
    .boolean('release')
    .boolean('typeOnly')
    .array('cp')
    .argv;

build(argv.cp, argv.release, argv.typeOnly);
