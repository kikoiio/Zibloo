// core/tz.ts — 时区纯工具:IANA 时区下的墙上时间 ↔ epoch 换算。
// 用 Intl 全量 ICU;两次逼近处理夏令时边界(不存在的本地时刻顺延到下一有效时刻)。

export type TzParts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

const partFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string): Intl.DateTimeFormat {
	let dtf = partFormatters.get(tz);
	if (!dtf) {
		dtf = new Intl.DateTimeFormat('en-US', {
			timeZone: tz,
			hour12: false,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			weekday: 'short'
		});
		partFormatters.set(tz, dtf);
	}
	return dtf;
}

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function zonedParts(epoch: number, tz: string): TzParts {
	const parts = Object.fromEntries(partsFormatter(tz).formatToParts(new Date(epoch)).map((p) => [p.type, p.value]));
	return {
		year: Number(parts.year),
		month: Number(parts.month),
		day: Number(parts.day),
		// 24:00 归一到 0
		hour: Number(parts.hour) % 24,
		minute: Number(parts.minute),
		weekday: weekdays.indexOf(parts.weekday)
	};
}

export function tzOffsetMs(tz: string, utcEpoch: number): number {
	const p = zonedParts(utcEpoch, tz);
	return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - utcEpoch;
}

/** 把某时区的本地墙上时间解释为 epoch ms。 */
export function zonedEpoch(
	tz: string,
	p: { year: number; month: number; day: number; hour: number; minute: number }
): number {
	const guess = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
	let epoch = guess - tzOffsetMs(tz, guess);
	epoch = guess - tzOffsetMs(tz, epoch);
	return epoch;
}

export function addDays(p: TzParts, days: number): { year: number; month: number; day: number } {
	const d = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
	return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** 本地时区的当日 0 点 epoch。 */
export function startOfDay(epoch: number, tz: string): number {
	const p = zonedParts(epoch, tz);
	return zonedEpoch(tz, { year: p.year, month: p.month, day: p.day, hour: 0, minute: 0 });
}
