// Settings that follow the person, not the device (owner, 2026-11-07: "all our settings synced to the user account",
// in the backup and the export): appearance, units, the scan and Progress choices, and notes already dismissed. Kept on
// the profile row (goals module); cookies only render the right look before signing in. A device's time zone and its
// waiting entries describe the device, so they stay on it.
import * as v from 'valibot';
import { APP_ICONS, DEFAULT_APP_ICON, type AppIconId } from './app-icons.ts';
import { DEFAULT_PALETTE, PALETTES, type PaletteId } from './themes.ts';

export interface Preferences {
	themeMode: 'system' | 'light' | 'dark';
	palette: PaletteId;
	appIcon: AppIconId;
	timeFormat: 'device' | '24' | '12';
	/** Progress: the weight chart shows readings or the trend. */
	weightView: 'readings' | 'trend';
	/** The grey "Speak is off" card was dismissed. */
	voiceOffSeen: boolean;
	/** Today's tip about holding entries was dismissed. */
	holdHintSeen: boolean;
	/** The goal weight (kg) at which "Switch to maintain" was declined; the offer returns with a new goal. */
	maintainOfferDeclinedKg: number | null;
}

export const DEFAULT_PREFERENCES: Preferences = {
	themeMode: 'system',
	palette: DEFAULT_PALETTE,
	appIcon: DEFAULT_APP_ICON,
	timeFormat: 'device',
	weightView: 'readings',
	voiceOffSeen: false,
	holdHintSeen: false,
	maintainOfferDeclinedKg: null
};

/** Any of the settings, as a change. */
export const PreferencesInput = v.strictObject({
	themeMode: v.optional(v.picklist(['system', 'light', 'dark'])),
	palette: v.optional(v.picklist(PALETTES.map((p) => p.id))),
	appIcon: v.optional(v.picklist(APP_ICONS.map((i) => i.id))),
	timeFormat: v.optional(v.picklist(['device', '24', '12'])),
	weightView: v.optional(v.picklist(['readings', 'trend'])),
	voiceOffSeen: v.optional(v.boolean()),
	holdHintSeen: v.optional(v.boolean()),
	maintainOfferDeclinedKg: v.optional(
		v.nullable(v.pipe(v.number(), v.finite(), v.minValue(20), v.maxValue(700)))
	)
});
export type PreferencesInput = v.InferOutput<typeof PreferencesInput>;
