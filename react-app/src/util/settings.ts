const SETTINGS_KEY = "TIFT_SETTINGS";

export type UIType = "bubble" | "normal";

export interface Settings {
    uiType : UIType;
}

export const DEFAULT_SETTINGS : Settings = {
    uiType : "bubble"
};

export function saveSettings(settings : Settings)  {
    const settingsString = JSON.stringify(settings);
    window.localStorage.setItem(SETTINGS_KEY, settingsString);
}

export function loadSettings() : Settings {
    const settingsString = window.localStorage.getItem(SETTINGS_KEY);
    if (settingsString) {
        try {
            const settings = JSON.parse(settingsString) as Settings;
            return settings;
        } catch {
            // ignore error and return default settings
        }
    }
    return DEFAULT_SETTINGS;
}