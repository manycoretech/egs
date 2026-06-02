export class Platform {
    private static instance: Platform;

    desktop: boolean = false;
    mobile: boolean = false;
    ios: boolean = false;
    android: boolean = false;
    windows: boolean = false;
    openHarmony: boolean = false;
    isSafari: boolean = false;
    isChromeMac = false;
    ua = '';

    constructor() {
        const ua = navigator.userAgent;
        this.ua = ua;

        if (/(windows|mac oc|linux|cors)/i.test(ua)) {
            this.desktop = true;
        }

        if (/Mac/i.test(ua) && /Chrome/i.test(ua)) {
            this.isChromeMac = true;
        }
        if (/^((?!chrome|android).)*safari/i.test(ua)) {
            this.isSafari = true;
        }

        if (/(windows phone|iemobile|wpdesktop)/i.test(ua)) {
            this.desktop = false;
            this.mobile = true;
            this.windows = true;
        } else if (/android/i.test(ua)) {
            this.desktop = false;
            this.mobile = true;
            this.android = true;
        } else if (/ip([ao]d|hone)/i.test(ua)) {
            this.desktop = false;
            this.mobile = true;
            this.ios = true;
        } else if (/OpenHarmony/i.test(ua)) {
            const isDesktop = /PC/i.test(ua);
            this.desktop = isDesktop;
            this.mobile = !isDesktop;
            this.openHarmony = true;
        }
    }

    static getInstance(): Platform {
        return Platform.instance || (Platform.instance = new Platform());
    }
}
