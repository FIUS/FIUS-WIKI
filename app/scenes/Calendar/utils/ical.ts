import { addDays, format } from "date-fns";
import { CalendarEventRecurrenceFrequency } from "@shared/types";
import type CalendarEvent from "~/models/CalendarEvent";

/**
 * Escapes special characters in iCalendar text fields per RFC 5545.
 *
 * @param value The raw text to escape.
 * @returns The escaped iCalendar string.
 */
function escapeICalText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Formats a Date object as an UTC iCalendar timestamp (YYYYMMDDTHHMMSSZ).
 *
 * @param date The date to format.
 * @returns The formatted UTC timestamp string.
 */
function formatICalUTCDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}` +
    `${pad(date.getUTCMonth() + 1)}` +
    `${pad(date.getUTCDate())}T` +
    `${pad(date.getUTCHours())}` +
    `${pad(date.getUTCMinutes())}` +
    `${pad(date.getUTCSeconds())}Z`
  );
}

/**
 * Formats a Date object as an iCalendar all-day date value (YYYYMMDD).
 *
 * @param date The date to format.
 * @returns The formatted date string.
 */
function formatICalDateOnly(date: Date): string {
  return format(date, "yyyyMMdd");
}

/**
 * Builds an RFC 5545 RRULE line for a recurring calendar event.
 *
 * @param event The calendar event.
 * @returns The RRULE property string, or null if non-recurring.
 */
function buildRRule(event: CalendarEvent): string | null {
  if (!event.recurrenceFrequency) {
    return null;
  }

  const parts: string[] = [];

  switch (event.recurrenceFrequency) {
    case CalendarEventRecurrenceFrequency.Daily:
      parts.push("FREQ=DAILY");
      break;
    case CalendarEventRecurrenceFrequency.Weekdays:
      parts.push("FREQ=WEEKLY", "BYDAY=MO,TU,WE,TH,FR");
      break;
    case CalendarEventRecurrenceFrequency.Weekly:
      parts.push("FREQ=WEEKLY");
      break;
    case CalendarEventRecurrenceFrequency.Biweekly:
      parts.push("FREQ=WEEKLY", "INTERVAL=2");
      break;
    case CalendarEventRecurrenceFrequency.Monthly:
      parts.push("FREQ=MONTHLY");
      break;
    case CalendarEventRecurrenceFrequency.Yearly:
      parts.push("FREQ=YEARLY");
      break;
    default:
      return null;
  }

  if (event.recurrenceEndAt) {
    const untilDate = new Date(event.recurrenceEndAt);
    if (!Number.isNaN(untilDate.getTime())) {
      parts.push(`UNTIL=${formatICalUTCDateTime(untilDate)}`);
    }
  }

  return `RRULE:${parts.join(";")}`;
}

/**
 * Generates an RFC 5545 iCalendar (.ics) string for a list of calendar events.
 *
 * @param events The calendar events to serialize.
 * @returns A complete VCALENDAR string.
 */
export function generateICalendar(events: CalendarEvent[]): string {
  const nowUtc = formatICalUTCDateTime(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Outline//Workspace Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const event of events) {
    const start = new Date(event.startAt);
    const end = new Date(event.endAt);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.id}@outline.calendar`);
    lines.push(`DTSTAMP:${nowUtc}`);

    if (event.allDay) {
      // In RFC 5545, DTEND for VALUE=DATE is exclusive (the day after the last day)
      const exclusiveEnd = addDays(
        new Date(end.getFullYear(), end.getMonth(), end.getDate()),
        1
      );
      lines.push(`DTSTART;VALUE=DATE:${formatICalDateOnly(start)}`);
      lines.push(`DTEND;VALUE=DATE:${formatICalDateOnly(exclusiveEnd)}`);
    } else {
      lines.push(`DTSTART:${formatICalUTCDateTime(start)}`);
      lines.push(`DTEND:${formatICalUTCDateTime(end)}`);
    }

    lines.push(`SUMMARY:${escapeICalText(event.title)}`);

    const descriptionParts: string[] = [];
    if (event.description) {
      descriptionParts.push(event.description);
    }

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    for (const col of event.collections ?? []) {
      descriptionParts.push(
        `Collection: ${col.displayName} (${origin}${col.path})`
      );
    }
    for (const doc of event.documents ?? []) {
      descriptionParts.push(
        `Document: ${doc.displayTitle} (${origin}${doc.path})`
      );
    }

    if (descriptionParts.length > 0) {
      lines.push(
        `DESCRIPTION:${escapeICalText(descriptionParts.join("\n\n"))}`
      );
    }

    if (event.tags && event.tags.length > 0) {
      lines.push(
        `CATEGORIES:${event.tags.map((tag) => escapeICalText(tag)).join(",")}`
      );
    }

    for (const assignee of event.assignees ?? []) {
      lines.push(
        `ATTENDEE;CN="${escapeICalText(assignee.name)}":urn:uuid:${assignee.id}`
      );
    }

    const rrule = buildRRule(event);
    if (rrule) {
      lines.push(rrule);
    }

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

/**
 * Triggers a browser download of an iCalendar (.ics) file for the given events.
 *
 * @param events The calendar events to export.
 * @param filename Desired file name (ending in .ics).
 */
export function downloadICalendar(
  events: CalendarEvent[],
  filename = "outline-calendar.ics"
): void {
  const icsContent = generateICalendar(events);
  const blob = new Blob([icsContent], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
