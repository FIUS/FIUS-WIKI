import { CalendarEventPermissionType } from "@shared/types";
import {
  buildAdmin,
  buildCalendarEvent,
  buildGroup,
  buildGroupUser,
  buildTeam,
  buildUser,
} from "@server/test/factories";
import { serialize } from "./index";

describe("policies/calendarEvent", () => {
  it("should allow creator and admin to update and delete", async () => {
    const team = await buildTeam();
    const admin = await buildAdmin({ teamId: team.id });
    const creator = await buildUser({ teamId: team.id });
    const event = await buildCalendarEvent({
      teamId: team.id,
      createdById: creator.id,
    });

    expect(serialize(creator, event).update).toBe(true);
    expect(serialize(creator, event).delete).toBe(true);
    expect(serialize(admin, event).update).toBe(true);
    expect(serialize(admin, event).delete).toBe(true);
  });

  it("should allow group member to update when permission is group", async () => {
    const team = await buildTeam();
    const creator = await buildUser({ teamId: team.id });
    const member = await buildUser({ teamId: team.id });
    const group = await buildGroup({ teamId: team.id });

    await buildGroupUser({
      groupId: group.id,
      userId: member.id,
    });

    const event = await buildCalendarEvent({
      teamId: team.id,
      createdById: creator.id,
      permissionType: CalendarEventPermissionType.Group,
      groupId: group.id,
    });

    // Reload with associations
    await event.reload();

    expect(serialize(member, event).update).toBe(true);
  });
});
