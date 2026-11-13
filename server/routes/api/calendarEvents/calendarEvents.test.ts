import { CalendarEventPermissionType } from "@shared/types";
import type { User } from "@server/models";
import {
  buildAdmin,
  buildCalendarEvent,
  buildTeam,
  buildUser,
} from "@server/test/factories";
import { getTestServer } from "@server/test/support";

const server = getTestServer();

describe("#calendarEvents.create", () => {
  let user: User;

  beforeEach(async () => {
    user = await buildUser();
  });

  it("should create a calendar event", async () => {
    const res = await server.post("/api/calendarEvents.create", user, {
      body: {
        title: "Sprint Planning",
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        allDay: false,
        color: "#4E70F0",
      },
    });
    const body = await res.json();

    expect(res.status).toEqual(200);
    expect(body.data.title).toEqual("Sprint Planning");
    expect(body.data.color).toEqual("#4E70F0");
  });

  it("should fail when title is missing", async () => {
    const res = await server.post("/api/calendarEvents.create", user, {
      body: {
        startAt: new Date().toISOString(),
        endAt: new Date().toISOString(),
      },
    });

    expect(res.status).toEqual(400);
  });
});

describe("#calendarEvents.list", () => {
  it("should list events for the user's team", async () => {
    const team = await buildTeam();
    const user = await buildUser({ teamId: team.id });
    const event = await buildCalendarEvent({ teamId: team.id });

    const res = await server.post("/api/calendarEvents.list", user, {
      body: {},
    });
    const body = await res.json();

    expect(res.status).toEqual(200);
    expect(body.data.some((e: { id: string }) => e.id === event.id)).toBe(true);
  });
});

describe("#calendarEvents.update", () => {
  it("should allow creator to update event", async () => {
    const team = await buildTeam();
    const creator = await buildUser({ teamId: team.id });
    const event = await buildCalendarEvent({
      teamId: team.id,
      createdById: creator.id,
    });

    const res = await server.post("/api/calendarEvents.update", creator, {
      body: {
        id: event.id,
        title: "Updated Title",
      },
    });
    const body = await res.json();

    expect(res.status).toEqual(200);
    expect(body.data.title).toEqual("Updated Title");
  });

  it("should allow admin to update event", async () => {
    const team = await buildTeam();
    const creator = await buildUser({ teamId: team.id });
    const admin = await buildAdmin({ teamId: team.id });
    const event = await buildCalendarEvent({
      teamId: team.id,
      createdById: creator.id,
    });

    const res = await server.post("/api/calendarEvents.update", admin, {
      body: {
        id: event.id,
        title: "Admin Updated Title",
      },
    });
    const body = await res.json();

    expect(res.status).toEqual(200);
    expect(body.data.title).toEqual("Admin Updated Title");
  });

  it("should forbid non-creator member when permission is creator_or_admin", async () => {
    const team = await buildTeam();
    const creator = await buildUser({ teamId: team.id });
    const otherUser = await buildUser({ teamId: team.id });
    const event = await buildCalendarEvent({
      teamId: team.id,
      createdById: creator.id,
      permissionType: CalendarEventPermissionType.CreatorOrAdmin,
    });

    const res = await server.post("/api/calendarEvents.update", otherUser, {
      body: {
        id: event.id,
        title: "Should Fail",
      },
    });

    expect(res.status).toEqual(403);
  });
});

describe("#calendarEvents.delete", () => {
  it("should allow creator to delete event", async () => {
    const team = await buildTeam();
    const creator = await buildUser({ teamId: team.id });
    const event = await buildCalendarEvent({
      teamId: team.id,
      createdById: creator.id,
    });

    const res = await server.post("/api/calendarEvents.delete", creator, {
      body: {
        id: event.id,
      },
    });
    const body = await res.json();

    expect(res.status).toEqual(200);
    expect(body.success).toBe(true);
  });
});
