import child_process from 'node:child_process';
import path from 'node:path';
const binRoots = [path.resolve('./node_modules/.bin')];
const parent = child_process.execSync('git rev-parse --show-superproject-working-tree').toString().trimEnd('\n');
if (parent) {
    binRoots.push(path.join(parent, 'node_modules/.bin'));
}
const cmd = `lint-staged ${process.argv.slice(2)}`;
console.log(cmd);
child_process.execSync(cmd, {
    stdio: 'inherit',
    env: {
        ...process.env,
        PATH: binRoots.join(path.delimiter) + path.delimiter + process.env.PATH,
    },
});
