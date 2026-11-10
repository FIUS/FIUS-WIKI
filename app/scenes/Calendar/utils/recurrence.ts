import {
  differenceInCalendarDays,
  differenceInCalendarWeeks,
  eachDayOfInterval,
  endOfDay,
  format,
  getDaysInMonth,
  isWeekend,
  startOfDay,
  subDays,
} from "date-fns";
import type { TFunction } from "i18next";
import { CalendarEventRecurrenceFrequency } from "@shared/types";
import type CalendarEvent from "~/models/CalendarEvent";

/**
 * Checks whether an occurrence of a recurring event starts on the given target day.
 *
 * @param baseStartDay The start-of-day of the initial event occurrence.
 * @param targetDay The start-of-day of the candidate occurrence date.
 * @param frequency The recurrence frequency rule.
 * @returns True if an occurrence begins on targetDay.
 */
function doesOccurrenceStartOnDay(
  baseStartDay: Date,
  targetDay: Date,
  frequency: CalendarEventRecurrenceFrequency
): boolean {
  const daysDiff = differenceInCalendarDays(targetDay, baseStartDay);
  if (daysDiff < 0) {
    return false;
  }

  if (daysDiff === 0) {
    return true;
  }

  switch (frequency) {
    case CalendarEventRecurrenceFrequency.Daily:
      return true;

    case CalendarEventRecurrenceFrequency.Weekdays:
      return !isWeekend(targetDay);

    case CalendarEventRecurrenceFrequency.Weekly:
      return targetDay.getDay() === baseStartDay.getDay();

    case CalendarEventRecurrenceFrequency.Biweekly:
      return (
        targetDay.getDay() === baseStartDay.getDay() &&
        differenceInCalendarWeeks(targetDay, baseStartDay, {
          weekStartsOn: 1,
        }) %
          2 ===
          0
      );

    case CalendarEventRecurrenceFrequency.Monthly: {
      const targetDayOfMonth = Math.min(
        baseStartDay.getDate(),
        getDaysInMonth(targetDay)
      );
      return targetDay.getDate() === targetDayOfMonth;
    }

    case CalendarEventRecurrenceFrequency.Yearly: {
      if (targetDay.getMonth() !== baseStartDay.getMonth()) {
        return false;
      }
      const targetDayOfMonth = Math.min(
        baseStartDay.getDate(),
        getDaysInMonth(targetDay)
      );
      return targetDay.getDate() === targetDayOfMonth;
    }

    default:
      return false;
  }
}

/**
 * Determines whether a calendar event (single or recurring) occurs on a given day.
 *
 * @param event The calendar event to test.
 * @param day The calendar day to check.
 * @returns True if the event is active on the given day.
 */
export function doesEventOccurOnDay(event: CalendarEvent, day: Date): boolean {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  const eventStart = new Date(event.startAt);
  const eventEnd = new Date(event.endAt);

  if (!event.recurrenceFrequency) {
    return eventStart <= dayEnd && eventEnd >= dayStart;
  }

  const baseStartDay = startOfDay(eventStart);
  if (dayStart < baseStartDay) {
    return false;
  }

  const recurrenceLimit = event.recurrenceEndAt
    ? endOfDay(new Date(event.recurrenceEndAt))
    : null;

  const spanDays = Math.min(
    Math.max(0, differenceInCalendarDays(startOfDay(eventEnd), baseStartDay)),
    30
  );

  for (let offset = 0; offset <= spanDays; offset++) {
    const candidateStartDay = subDays(dayStart, offset);
    if (candidateStartDay < baseStartDay) {
      break;
    }
    if (recurrenceLimit && candidateStartDay > recurrenceLimit) {
      continue;
    }
    if (
      doesOccurrenceStartOnDay(
        baseStartDay,
        candidateStartDay,
        event.recurrenceFrequency
      )
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Formats a human-readable recurrence description for a calendar event.
 *
 * @param event The calendar event.
 * @param t The translation function.
 * @returns A localized summary string, or null if the event does not repeat.
 */
export function formatRecurrenceLabel(
  event: Pick<CalendarEvent, "recurrenceFrequency" | "recurrenceEndAt">,
  t: TFunction
): string | null {
  if (!event.recurrenceFrequency) {
    return null;
  }

  let freqText: string;
  switch (event.recurrenceFrequency) {
    case CalendarEventRecurrenceFrequency.Daily:
      freqText = t("Repeats daily");
      break;
    case CalendarEventRecurrenceFrequency.Weekdays:
      freqText = t("Repeats every weekday (Mon–Fri)");
      break;
    case CalendarEventRecurrenceFrequency.Weekly:
      freqText = t("Repeats weekly");
      break;
    case CalendarEventRecurrenceFrequency.Biweekly:
      freqText = t("Repeats every 2 weeks");
      break;
    case CalendarEventRecurrenceFrequency.Monthly:
      freqText = t("Repeats monthly");
      break;
    case CalendarEventRecurrenceFrequency.Yearly:
      freqText = t("Repeats yearly");
      break;
    default:
      return null;
  }

  if (event.recurrenceEndAt) {
    try {
      const untilStr = format(new Date(event.recurrenceEndAt), "MMM d, yyyy");
      return t("{{frequency}} · Until {{date}}", {
        frequency: freqText,
        date: untilStr,
      });
    } catch {
      return freqText;
    }
  }

  return freqText;
}

export interface DayScheduleGroup {
  date: Date;
  events: CalendarEvent[];
}

/**
 * Groups events by each calendar day they occur on within the given date interval.
 *
 * @param events The filtered list of calendar events.
 * @param start The start of the date range.
 * @param end The end of the date range.
 * @returns An array of day groups that have at least one event.
 */
export function getDayScheduleGroups(
  events: CalendarEvent[],
  start: Date,
  end: Date
): DayScheduleGroup[] {
  const days = eachDayOfInterval({ start, end });
  const groups: DayScheduleGroup[] = [];

  for (const day of days) {
    const matching = events.filter((event) => doesEventOccurOnDay(event, day));
    if (matching.length > 0) {
      groups.push({
        date: day,
        events: matching,
      });
    }
  }

  return groups;
}
