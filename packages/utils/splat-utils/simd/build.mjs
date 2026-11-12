import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { writeArraybuffer } from '@internal/utils/array-buffer.js';

if (!process.env.EMSDK_HOME) {
  throw new Error('Set EMSDK_HOME to the Emscripten SDK root before running build:wasm.');
}

const sdkDir = resolve(process.env.EMSDK_HOME);
const emscriptenDir = join(sdkDir, 'upstream', 'emscripten');
const emcmake = join(emscriptenDir, process.platform === 'win32' ? 'emcmake.exe' : 'emcmake');
const emcmakeScript = join(emscriptenDir, 'emcmake.py');
if (!existsSync(emcmake) && !existsSync(emcmakeScript)) {
  throw new Error(`Cannot find emcmake in ${emscriptenDir}. Check EMSDK_HOME and install the SDK toolchain.`);
}

const buildDir = join(import.meta.dirname, 'build');
const env = { ...process.env };
const pathKey = Object.keys(env).find(key => key.toUpperCase() === 'PATH') || 'PATH';
env[pathKey] = [emscriptenDir, join(sdkDir, 'upstream', 'bin'), env[pathKey] || ''].join(delimiter);
const options = { cwd: import.meta.dirname, env, stdio: 'inherit' };
const configureArgs = ['cmake', '-S', import.meta.dirname, '-B', buildDir, '-G', 'Ninja', '-DCMAKE_BUILD_TYPE=Release'];

if (existsSync(emcmake)) {
  execFileSync(emcmake, configureArgs, options);
} else {
  // Older Windows SDKs provide a batch launcher; invoke its Python entry point directly.
  const python = process.env.EMSDK_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  execFileSync(python, [emcmakeScript, ...configureArgs], options);
}
execFileSync('ninja', ['-C', buildDir], options);

for (const extension of ['js', 'd.ts']) {
  const filename = `sort-module.${extension}`;
  copyFileSync(join(buildDir, filename), join(import.meta.dirname, filename));
}
// Embed the binary for both module workers and worker-loader's inline workers.
writeArraybuffer(join(buildDir, 'sort-module.wasm'), join(import.meta.dirname, 'sort.wasm.js'), true);
