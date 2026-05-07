export { logger } from '@qunhe/egs-lib';

interface KtrackerEvent {
    eventType: string,
    data?: Record<string, number>,
    error?: Error,
    labels?: Record<string, string>,
}

let isKtrackerAvailable = true;
export function sendKtrackerEvent(message: KtrackerEvent, isSendToError: boolean = false) {
    if (!isKtrackerAvailable) {
        return;
    }
    message.labels = {
        feBu: 'kujiale-fe-tool-egs-logger',
        ...(message.labels || {}),
    };
    try {
        if (isSendToError) {
            (window as any).Ktracker.sendErrorV2(message);
        } else {
            (window as any).Ktracker.sendEventV2(message);
        }
    } catch {
        isKtrackerAvailable = false;
        // eslint-disable-next-line no-restricted-syntax
        console.warn('Failed to send ktracker event! Ktracker maybe unavailable');
    }
}
