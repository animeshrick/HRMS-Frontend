// A time picker that always uses the 12 hour clock (a browser's own time box follows the computer's settings, often 24 hour).
// The value it reports is "HH:MM" on the 24 hour clock, because that is what the backend expects. It is empty until the hour, minute and AM or PM are all chosen.
import { useState } from "react";

interface TimeFieldProps {
  label: string; // for example "Check-out time (optional)"
  value: string; // "" or "19:05"
  onChange: (value: string) => void;
}

const HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1));
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

/** "19:05" -> { hour: "7", minute: "05", period: "PM" } */
function splitValue(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return { hour: "", minute: "", period: "" };
  }
  const hour24 = Number(value.slice(0, 2));
  return { hour: String(hour24 % 12 === 0 ? 12 : hour24 % 12), minute: value.slice(3), period: hour24 >= 12 ? "PM" : "AM" };
}

function joinValue(hour: string, minute: string, period: string): string {
  if (!hour || !minute || !period) {
    return "";
  }
  const hour24 = (Number(hour) % 12) + (period === "PM" ? 12 : 0);
  return `${String(hour24).padStart(2, "0")}:${minute}`;
}

export function TimeField({ label, value, onChange }: TimeFieldProps) {
  // A half chosen time (only the hour, say) is kept here until it is complete.
  const [draft, setDraft] = useState(() => splitValue(value));
  const shown = value ? splitValue(value) : draft;

  function change(part: "hour" | "minute" | "period", newValue: string) {
    const next = { ...shown, [part]: newValue };
    setDraft(next);
    onChange(joinValue(next.hour, next.minute, next.period));
  }

  const selectClassName = "field px-2 py-1.5";
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1">{label}</legend>
      <div className="flex gap-1">
        <select aria-label={`${label} hour`} value={shown.hour} onChange={(event) => change("hour", event.target.value)} className={selectClassName}>
          <option value="">Hr</option>
          {HOURS.map((hour) => (
            <option key={hour} value={hour}>
              {hour}
            </option>
          ))}
        </select>
        <select aria-label={`${label} minute`} value={shown.minute} onChange={(event) => change("minute", event.target.value)} className={selectClassName}>
          <option value="">Min</option>
          {MINUTES.map((minute) => (
            <option key={minute} value={minute}>
              {minute}
            </option>
          ))}
        </select>
        <select aria-label={`${label} AM or PM`} value={shown.period} onChange={(event) => change("period", event.target.value)} className={selectClassName}>
          <option value="">AM/PM</option>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </fieldset>
  );
}
