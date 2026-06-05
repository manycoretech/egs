export function setFlags(current: number, flag: number, enabled: boolean) {
    return enabled ? current | flag : current & ~flag;
}

export function enableFlags(current: number, flag: number) {
    return current | flag;
}

export function disableFlags(current: number, flag: number) {
    return current & ~flag;
}

export function intersectFlags(a: number, b: number) {
    return (a & b) > 0;
}

export function hasFlags(a: number, b: number) {
    return (a & b) === b;
}
