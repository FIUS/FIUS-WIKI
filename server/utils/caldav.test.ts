import { CalendarEventRecurrenceFrequency } from "@shared/types";
import {
  parseICalendarEvents,
  resolveEventIdFromUid,
  serializeSingleEventToICal,
} from "./caldav";

describe("caldav utility", () => {
  it("should preserve Outline UUIDs and deterministically map external UIDs", () => {
    const teamId = "11111111-1111-4111-8111-111111111111";
    const outlineId = "22222222-2222-4222-8222-222222222222";

    expect(resolveEventIdFromUid(teamId, `${outlineId}@outline.calendar`)).toBe(
      outlineId
    );

    const extId1 = resolveEventIdFromUid(
      teamId,
      "external-event-123@nextcloud"
    );
    const extId2 = resolveEventIdFromUid(
      teamId,
      "external-event-123@nextcloud"
    );
    expect(extId1).toBe(extId2);
    expect(extId1).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it("should round-trip serialize and parse VEVENT with tags, recurrence, and attendees", () => {
    const ics = serializeSingleEventToICal({
      id: "33333333-3333-4333-8333-333333333333",
      title: "Product Launch Sync",
      description: "Final checklist\nWith team",
      startAt: "2026-11-20T10:00:00.000Z",
      endAt: "2026-11-20T11:00:00.000Z",
      allDay: false,
      tags: ["Release", "Meeting"],
      recurrenceFrequency: CalendarEventRecurrenceFrequency.Weekly,
      recurrenceEndAt: "2026-12-20T23:59:59.000Z",
    });

    const parsed = parseICalendarEvents(ics);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].uid).toBe(
      "33333333-3333-4333-8333-333333333333@outline.calendar"
    );
    expect(parsed[0].title).toBe("Product Launch Sync");
    expect(parsed[0].description).toBe("Final checklist\nWith team");
    expect(parsed[0].allDay).toBe(false);
    expect(parsed[0].tags).toEqual(["Release", "Meeting"]);
    expect(parsed[0].recurrenceFrequency).toBe(
      CalendarEventRecurrenceFrequency.Weekly
    );
    expect(parsed[0].recurrenceEndAt?.toISOString()).toBe(
      "2026-12-20T23:59:59.000Z"
    );
  });
});
