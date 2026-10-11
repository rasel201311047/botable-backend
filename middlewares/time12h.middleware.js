/**
 * Global 12-hour clock for human-readable text.
 *
 * Internally the backend stores/exchanges times as machine-readable "HH:MM" (24h) strings.
 * Anything the user *reads* (AI advice, coach notes, chat replies, notifications, calendar
 * subtitles, ...) must use the 12-hour format ("9:30 PM") instead.
 *
 * `localizeTimes` rewrites every "HH:MM" that is embedded in a longer sentence / range
 * ("bed by 22:30", "08:15-09:45"). Strings that are *exactly* "HH:MM" are left alone because they
 * are structured fields (`scheduledTime`, `shiftStart`, `plan.bedtime`, ...) that the app parses
 * and formats itself (see `app/src/utils/time.ts`).
 */

const EXACT_HHMM = /^\s*\d{1,2}:\d{2}\s*$/;
// Not preceded by a word char / ":" / "." (skips ISO timestamps like 2026-10-11T14:44:28Z)
// and not followed by digits, ":" or an existing AM/PM marker.
const EMBEDDED_HHMM = /(?<![\w:.])([01]?\d|2[0-3]):([0-5]\d)(?![\d:]|\s?[AaPp]\.?[Mm])/g;

const MAX_DEPTH = 14;

/** "21:05" -> "9:05 PM" */
const to12h = (hours, minutes) => {
  const h = Number(hours);
  return `${h % 12 === 0 ? 12 : h % 12}:${minutes} ${h >= 12 ? 'PM' : 'AM'}`;
};

/** Convert every embedded 24h time in a sentence to 12h. */
const to12hText = text => {
  if (typeof text !== 'string' || text.length < 5 || EXACT_HHMM.test(text)) return text;
  return text.replace(EMBEDDED_HHMM, (_m, h, m) => to12h(h, m));
};

const isPlainObject = value =>
  value !== null && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;

/** Deep-convert the prose strings of a JSON-serialisable value (returns a new structure). */
const localizeTimes = (value, depth = 0) => {
  if (typeof value === 'string') return to12hText(value);
  if (value === null || typeof value !== 'object' || depth > MAX_DEPTH) return value;

  if (Array.isArray(value)) return value.map(item => localizeTimes(item, depth + 1));

  // Mongoose documents, ObjectIds, Dates, ... -> their JSON form (what express would send anyway)
  if (!isPlainObject(value)) {
    if (typeof value.toJSON === 'function') return localizeTimes(value.toJSON(), depth + 1);
    return value;
  }

  const out = {};
  for (const key of Object.keys(value)) out[key] = localizeTimes(value[key], depth + 1);
  return out;
};

/** Express middleware: localise times in every JSON body sent by the mounted router. */
const time12hMiddleware = (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = body => {
    try {
      return originalJson(localizeTimes(body));
    } catch (_err) {
      return originalJson(body);
    }
  };
  next();
};

module.exports = { time12hMiddleware, localizeTimes, to12hText, to12h };
