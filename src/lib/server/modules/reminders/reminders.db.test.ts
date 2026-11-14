import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import type { ReminderKind } from '../../../shared/reminders.ts';
import { createBody } from '../body/index.ts';
import { createDiary } from '../diary/index.ts';
import { reminderTitle } from '../../reminder-text.ts';
import {
	createReminders,
	sendDueReminders,
	type Delivery,
	type DeliveryResult
} from './service.ts';

const urls = inject('db');
const quiet = { onnotice: () => {} };
const admin = postgres(urls.admin, { max: 1, ...quiet });
const appSql = postgres(urls.app, { max: 2, ...quiet });
const workerSql = postgres(urls.worker, { max: 2, ...quiet });
const app = drizzle(appSql);
const worker = drizzle(workerSql);
const reminders = createReminders(app);
const diary = createDiary(app);
const body = createBody(app);

const AYSE = randomUUID();
const MEHMET = randomUUID();
const ZONE = 'Europe/Istanbul';
const DAY = '2026-10-31';
const at = (hhmm: string) => new Date(`${DAY}T${hhmm}:00+03:00`);
const device = (n: number) => ({
	endpoint: `https://push.example/${n}`,
	keys: { p256dh: `key-${n}`, auth: `auth-${n}` }
});
const on = (times: Partial<Record<ReminderKind, string>>) =>
	reminders.saveSettings(AYSE, {
		zone: ZONE,
		times: {
			breakfast: null,
			lunch: null,
			dinner: null,
			weigh_in: null,
			day_complete: null,
			...times
		},
		quietStart: '22:00',
		quietEnd: '08:00'
	});

/** Records deliveries; answers per endpoint (sent unless told otherwise). */
function postbox(answers: Record<string, DeliveryResult> = {}) {
	const got: { endpoint: string; kind: ReminderKind; language: string }[] = [];
	const deliver = async (to: Delivery, kind: ReminderKind) => {
		got.push({ endpoint: to.endpoint, kind, language: to.language });
		return answers[to.endpoint] ?? 'sent';
	};
	return { got, deliver };
}

beforeEach(async () => {
	await admin`truncate users cascade`;
	await admin`insert into users (id, display_name) values (${AYSE}, 'Ayşe'), (${MEHMET}, 'Mehmet')`;
});

afterAll(async () => {
	await Promise.all([admin.end(), appSql.end(), workerSql.end()]);
});

describe('settings and devices', () => {
	it('start off, save, and stay private', async () => {
		expect((await reminders.settings(AYSE, ZONE)).times.lunch).toBeNull();
		await on({ lunch: '14:00' });
		expect(await reminders.settings(AYSE, ZONE)).toMatchObject({
			zone: ZONE,
			times: { lunch: '14:00', dinner: null },
			quietStart: '22:00'
		});
		// Mehmet sees his own defaults, not Ayşe's settings.
		expect((await reminders.settings(MEHMET, 'UTC')).times.lunch).toBeNull();
	});

	it('keep one subscription per device and person, shared devices allowed', async () => {
		await reminders.subscribe(AYSE, device(1));
		await reminders.subscribe(AYSE, { ...device(1), keys: { p256dh: 'new', auth: 'new' } });
		await reminders.subscribe(MEHMET, device(1));
		expect(await admin`select user_id, p256dh from push_subscriptions order by p256dh`).toEqual([
			{ user_id: MEHMET, p256dh: 'key-1' },
			{ user_id: AYSE, p256dh: 'new' }
		]);
		expect(await reminders.subscribed(AYSE, device(1).endpoint)).toBe(true);
		await reminders.unsubscribe(AYSE, device(1).endpoint);
		expect(await reminders.subscribed(AYSE, device(1).endpoint)).toBe(false);
		expect(await reminders.subscribed(MEHMET, device(1).endpoint)).toBe(true);
	});
});

describe('sending', () => {
	it('sends a meal reminder once, only while the meal is empty', async () => {
		await on({ lunch: '14:00' });
		await reminders.subscribe(AYSE, device(1));
		await reminders.subscribe(AYSE, device(2));
		const box = postbox();
		expect(await sendDueReminders(worker, at('13:55'), box.deliver)).toBe(0);
		expect(await sendDueReminders(worker, at('14:05'), box.deliver)).toBe(1);
		expect(box.got.map((g) => g.endpoint).sort()).toEqual([device(1).endpoint, device(2).endpoint]);
		// Not again the same day.
		expect(await sendDueReminders(worker, at('14:20'), box.deliver)).toBe(0);
		expect(box.got).toHaveLength(2);
		// No profile yet: English.
		expect(box.got.every((g) => g.language === 'en')).toBe(true);
	});

	it('tells delivery the person’s language, so the text follows it', async () => {
		await on({ lunch: '14:00' });
		await reminders.subscribe(AYSE, device(1));
		await admin`insert into profiles (user_id, language) values (${AYSE}, 'tr')`;
		const box = postbox();
		expect(await sendDueReminders(worker, at('14:05'), box.deliver)).toBe(1);
		expect(box.got).toEqual([{ endpoint: device(1).endpoint, kind: 'lunch', language: 'tr' }]);
		expect(reminderTitle('lunch', 'tr', ['en', 'tr'])).toBe('Öğle yemeği henüz kaydedilmedi');
		// Until Turkish is enabled, it stays English.
		expect(reminderTitle('lunch', 'tr', ['en'])).toBe("Lunch isn't logged yet");
	});

	it('stays quiet when the meal, weigh-in or completion is already there', async () => {
		await on({ dinner: '20:00', weigh_in: '09:00', day_complete: '21:00' });
		await reminders.subscribe(AYSE, device(1));
		const ctx = { localDate: DAY, meal: 'dinner' as const, zone: ZONE };
		await diary.quickAdd(AYSE, ctx, 600, 'Pilav');
		await body.logWeight(AYSE, { localDate: DAY, zone: ZONE }, 82.4);
		await diary.setDayComplete(AYSE, DAY, true);
		const box = postbox();
		for (const t of ['09:10', '20:10', '21:10']) await sendDueReminders(worker, at(t), box.deliver);
		expect(box.got).toEqual([]);
	});

	it("counts only the person's own diary and a live entry", async () => {
		await on({ lunch: '14:00' });
		await reminders.subscribe(AYSE, device(1));
		// Mehmet's lunch is not Ayşe's; a deleted lunch is no lunch.
		await diary.quickAdd(MEHMET, { localDate: DAY, meal: 'lunch', zone: ZONE }, 500, null);
		const gone = await diary.quickAdd(
			AYSE,
			{ localDate: DAY, meal: 'lunch', zone: ZONE },
			500,
			null
		);
		await diary.remove(AYSE, gone.id);
		const box = postbox();
		expect(await sendDueReminders(worker, at('14:05'), box.deliver)).toBe(1);
	});

	it('drops a gone device at once and a failing one after repeated failures', async () => {
		await on({ lunch: '14:00', dinner: '20:00' });
		await reminders.subscribe(AYSE, device(1));
		await reminders.subscribe(AYSE, device(2));
		const box = postbox({ [device(1).endpoint]: 'gone', [device(2).endpoint]: 'failed' });
		await sendDueReminders(worker, at('14:05'), box.deliver);
		expect(await admin`select endpoint, failures from push_subscriptions`).toEqual([
			{ endpoint: device(2).endpoint, failures: 1 }
		]);
	});

	it('skips disabled accounts and people without a device', async () => {
		await on({ lunch: '14:00' });
		const box = postbox();
		expect(await sendDueReminders(worker, at('14:05'), box.deliver)).toBe(0);
		await reminders.subscribe(AYSE, device(1));
		await admin`update users set disabled_at = now() where id = ${AYSE}`;
		expect(await sendDueReminders(worker, at('14:05'), box.deliver)).toBe(0);
		expect(box.got).toEqual([]);
	});

	it('gives the worker nothing without an identity', async () => {
		await reminders.subscribe(AYSE, device(1));
		expect(await workerSql`select * from push_subscriptions`).toHaveLength(0);
		await expect(workerSql`select * from reminder_settings`).rejects.toThrow();
	});
});
