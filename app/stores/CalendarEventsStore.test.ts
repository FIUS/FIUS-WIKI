import {
  CalendarEventPermissionType,
  CalendarEventRecurrenceFrequency,
} from "@shared/types";
import { generateICalendar } from "~/scenes/Calendar/utils/ical";
import {
  doesEventOccurOnDay,
  getDayScheduleGroups,
} from "~/scenes/Calendar/utils/recurrence";
import stores from "~/stores";

describe("CalendarEventsStore", () => {
  beforeEach(() => {
    stores.calendarEvents.clear();
  });

  it("should add and sort calendar events by startAt ascending", () => {
    const creator = stores.users.add({
      id: "11111111-1111-4111-8111-111111111111",
      name: "Alice",
    });

    const later = stores.calendarEvents.add({
      id: "22222222-2222-4222-8222-222222222222",
      title: "Afternoon Review",
      description: "Review sprint progress",
      startAt: "2026-11-15T14:00:00.000Z",
      endAt: "2026-11-15T15:00:00.000Z",
      allDay: false,
      color: "#0366d6",
      permissionType: CalendarEventPermissionType.CreatorOrAdmin,
      createdById: creator.id,
    });

    const earlier = stores.calendarEvents.add({
      id: "33333333-3333-4333-8333-333333333333",
      title: "Morning Standup",
      description: null,
      startAt: "2026-11-15T09:00:00.000Z",
      endAt: "2026-11-15T09:30:00.000Z",
      allDay: false,
      color: "#10B981",
      permissionType: CalendarEventPermissionType.All,
      createdById: creator.id,
    });

    expect(stores.calendarEvents.events.map((e) => e.id)).toEqual([
      earlier.id,
      later.id,
    ]);
    expect(later.createdBy).toBe(creator);
  });

  it("should resolve linked collection, document, and group relations", () => {
    const col = stores.collections.add({
      id: "40000000-4000-4000-8000-400000000000",
      name: "Product",
    });
    const doc = stores.documents.add({
      id: "44444444-4444-4444-8444-444444444444",
      title: "Release Spec",
    });
    const group = stores.groups.add({
      id: "55555555-5555-4555-8555-555555555555",
      name: "Engineering",
    });

    const event = stores.calendarEvents.add({
      id: "66666666-6666-4666-8666-666666666666",
      title: "Release Planning",
      startAt: "2026-11-20T10:00:00.000Z",
      endAt: "2026-11-20T11:00:00.000Z",
      allDay: false,
      collectionId: col.id,
      collectionIds: [col.id],
      documentId: doc.id,
      documentIds: [doc.id],
      permissionType: CalendarEventPermissionType.Group,
      groupId: group.id,
      createdById: "11111111-1111-4111-8111-111111111111",
    });

    expect(event.collection).toBe(col);
    expect(event.collections).toEqual([col]);
    expect(event.document).toBe(doc);
    expect(event.documents).toEqual([doc]);
    expect(event.group).toBe(group);
  });

  it("should resolve tags, assignees, and include CATEGORIES and ATTENDEE in iCal", () => {
    const assignee = stores.users.add({
      id: "88888888-8888-4888-8888-888888888888",
      name: "Bob",
      email: "bob@example.com",
    });

    const taggedEvent = stores.calendarEvents.add({
      id: "99999999-9999-4999-8999-999999999999",
      title: "Architecture Workshop",
      startAt: "2026-11-22T14:00:00.000Z",
      endAt: "2026-11-22T16:00:00.000Z",
      allDay: false,
      tags: ["Workshop", "Engineering"],
      assigneeIds: [assignee.id],
      permissionType: CalendarEventPermissionType.All,
      createdById: assignee.id,
    });

    expect(taggedEvent.tags).toEqual(["Workshop", "Engineering"]);
    expect(taggedEvent.assignees).toEqual([assignee]);

    const ics = generateICalendar([taggedEvent]);
    expect(ics).toContain("CATEGORIES:Workshop,Engineering");
    expect(ics).toContain('ATTENDEE;CN="Bob"');
  });

  it("should match recurring event occurrences across days and respect recurrenceEndAt", () => {
    const weeklyEvent = stores.calendarEvents.add({
      id: "77777777-7777-4777-8777-777777777777",
      title: "Weekly Sync",
      startAt: "2026-11-02T10:00:00.000Z", // Monday
      endAt: "2026-11-02T11:00:00.000Z",
      allDay: false,
      recurrenceFrequency: CalendarEventRecurrenceFrequency.Weekly,
      recurrenceEndAt: "2026-11-16T23:59:59.999Z",
      permissionType: CalendarEventPermissionType.All,
      createdById: "11111111-1111-4111-8111-111111111111",
    });

    expect(
      doesEventOccurOnDay(weeklyEvent, new Date("2026-11-02T12:00:00.000Z"))
    ).toBe(true);
    expect(
      doesEventOccurOnDay(weeklyEvent, new Date("2026-11-03T12:00:00.000Z"))
    ).toBe(false);
    expect(
      doesEventOccurOnDay(weeklyEvent, new Date("2026-11-09T12:00:00.000Z"))
    ).toBe(true);
    expect(
      doesEventOccurOnDay(weeklyEvent, new Date("2026-11-16T12:00:00.000Z"))
    ).toBe(true);
    expect(
      doesEventOccurOnDay(weeklyEvent, new Date("2026-11-23T12:00:00.000Z"))
    ).toBe(false);

    const groups = getDayScheduleGroups(
      [weeklyEvent],
      new Date("2026-11-01T00:00:00.000Z"),
      new Date("2026-11-30T23:59:59.000Z")
    );
    expect(groups).toHaveLength(3);

    const ics = generateICalendar([weeklyEvent]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("SUMMARY:Weekly Sync");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;UNTIL=");
  });
});
