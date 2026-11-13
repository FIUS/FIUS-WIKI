import { CalendarEventPermissionType } from "@shared/types";
import { CalendarEvent, Team, User } from "@server/models";
import { allow } from "./cancan";
import { isTeamModel } from "./utils";

allow(User, "createCalendarEvent", Team, isTeamModel);

allow(User, "read", CalendarEvent, isTeamModel);

allow(User, ["update", "delete"], CalendarEvent, (actor, event) => {
  if (!event || !isTeamModel(actor, event)) {
    return false;
  }

  // Workspace admins can always update and delete events
  if (actor.isAdmin) {
    return true;
  }

  // The creator can always update and delete their own event
  if (actor.id === event.createdById) {
    return true;
  }

  // If everyone in the workspace has permission to edit
  if (event.permissionType === CalendarEventPermissionType.All) {
    return true;
  }

  // If edit permission is granted to a specific group
  if (
    event.permissionType === CalendarEventPermissionType.Group &&
    event.groupId
  ) {
    if (event.group?.groupUsers) {
      return event.group.groupUsers.some((gu) => gu.userId === actor.id);
    }
  }

  return false;
});
