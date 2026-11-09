import crypto from "node:crypto";
import Router from "@koa/router";
import { addDays, format } from "date-fns";
import { uniq } from "es-toolkit/compat";
import { Op } from "sequelize";
import {
  CalendarEventRecurrenceFrequency,
  DEFAULT_CALENDAR_SETTINGS,
  type CalendarWorkspaceSettings,
} from "@shared/types";
import env from "@server/env";
import { AuthenticationError, AuthorizationError, NotFoundError } from "@server/errors";
import auth from "@server/middlewares/authentication";
import { rateLimiter } from "@server/middlewares/rateLimiter";
import { transaction } from "@server/middlewares/transaction";
import validate from "@server/middlewares/validate";
import {
  CalendarEvent,
  Collection,
  Document,
  Group,
  Team,
  User,
} from "@server/models";
import { authorize } from "@server/policies";
import {
  presentCalendarEvent,
  presentPolicies,
} from "@server/presenters";
import type { APIContext } from "@server/types";
import { safeEqual } from "@server/utils/crypto";
import { RateLimiterStrategy } from "@server/utils/RateLimiter";
import * as T from "./schema";

const router = new Router();

function computeFeedToken(teamId: string, userId: string): string {
  return crypto
    .createHmac("sha256", env.SECRET_KEY)
    .update(`caldav-feed:${teamId}:${userId}`)
    .digest("hex");
}

function escapeICal(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function formatICalUTC(date: Date): string {
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

function buildEventRRule(event: CalendarEvent): string | null {
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
    const until = new Date(event.recurrenceEndAt);
    if (!Number.isNaN(until.getTime())) {
      parts.push(`UNTIL=${formatICalUTC(until)}`);
    }
  }

  return `RRULE:${parts.join(";")}`;
}

router.post(
  "calendarEvents.list",
  auth(),
  validate(T.CalendarEventsListSchema),
  async (ctx: APIContext<T.CalendarEventsListReq>) => {
    const { user } = ctx.state.auth;
    const { startAt, endAt, collectionId, documentId, groupId } =
      ctx.input.body;

    const where: Record<string | symbol, unknown> = {
      teamId: user.teamId,
    };

    if (startAt && endAt) {
      where[Op.and] = [
        { startAt: { [Op.lte]: endAt } },
        {
          [Op.or]: [
            { endAt: { [Op.gte]: startAt } },
            {
              recurrenceFrequency: { [Op.ne]: null },
              [Op.or]: [
                { recurrenceEndAt: null },
                { recurrenceEndAt: { [Op.gte]: startAt } },
              ],
            },
          ],
        },
      ];
    } else if (startAt) {
      where[Op.or] = [
        { endAt: { [Op.gte]: startAt } },
        {
          recurrenceFrequency: { [Op.ne]: null },
          [Op.or]: [
            { recurrenceEndAt: null },
            { recurrenceEndAt: { [Op.gte]: startAt } },
          ],
        },
      ];
    } else if (endAt) {
      where.startAt = { [Op.lte]: endAt };
    }

    if (collectionId) {
      where.collectionId = collectionId;
    }

    if (documentId) {
      where.documentId = documentId;
    }

    if (groupId) {
      where.groupId = groupId;
    }

    const events = await CalendarEvent.findAll({
      where,
      order: [["startAt", "ASC"]],
    });

    ctx.body = {
      data: events.map(presentCalendarEvent),
      policies: presentPolicies(user, events),
    };
  }
);

router.post(
  "calendarEvents.info",
  auth(),
  validate(T.CalendarEventsInfoSchema),
  async (ctx: APIContext<T.CalendarEventsInfoReq>) => {
    const { user } = ctx.state.auth;
    const { id } = ctx.input.body;

    const event = await CalendarEvent.findByPk(id);
    if (!event || event.teamId !== user.teamId) {
      throw NotFoundError();
    }

    authorize(user, "read", event);

    ctx.body = {
      data: presentCalendarEvent(event),
      policies: presentPolicies(user, [event]),
    };
  }
);

router.post(
  "calendarEvents.create",
  rateLimiter(RateLimiterStrategy.TwentyFivePerMinute),
  auth(),
  validate(T.CalendarEventsCreateSchema),
  transaction(),
  async (ctx: APIContext<T.CalendarEventsCreateReq>) => {
    const { user } = ctx.state.auth;
    const {
      title,
      description,
      startAt,
      endAt,
      allDay,
      color,
      recurrenceFrequency,
      recurrenceEndAt,
      tags,
      assigneeIds,
      collectionId,
      collectionIds,
      documentId,
      documentIds,
      permissionType,
      groupId,
    } = ctx.input.body;

    authorize(user, "createCalendarEvent", user.team);

    const resolvedTags = uniq((tags ?? []).map((t) => t.trim()).filter(Boolean));
    let resolvedAssigneeIds: string[] = [];
    if (assigneeIds && assigneeIds.length > 0) {
      const validUsers = await User.findAll({
        attributes: ["id"],
        where: {
          id: uniq(assigneeIds),
          teamId: user.teamId,
        },
      });
      resolvedAssigneeIds = validUsers.map((u) => u.id);
    }

    const resolvedCollectionIds = uniq(
      collectionIds ?? (collectionId ? [collectionId] : [])
    );
    const resolvedDocumentIds = uniq(
      documentIds ?? (documentId ? [documentId] : [])
    );

    for (const colId of resolvedCollectionIds) {
      const collection = await Collection.findByPk(colId, {
        userId: user.id,
      });
      authorize(user, "read", collection);
    }

    for (const docId of resolvedDocumentIds) {
      const document = await Document.findByPk(docId, {
        userId: user.id,
      });
      authorize(user, "read", document);
    }

    let group: Group | null = null;
    if (groupId) {
      group = await Group.findByPk(groupId, {
        include: [{ association: "groupUsers", required: false }],
      });
      authorize(user, "read", group);
    }

    const effectiveRecurrence = recurrenceFrequency ?? null;

    const event = await CalendarEvent.createWithCtx(ctx, {
      title,
      description: description ?? null,
      startAt,
      endAt,
      allDay: allDay ?? false,
      color: color ?? null,
      recurrenceFrequency: effectiveRecurrence,
      recurrenceEndAt: effectiveRecurrence ? (recurrenceEndAt ?? null) : null,
      tags: resolvedTags,
      assigneeIds: resolvedAssigneeIds,
      collectionId: resolvedCollectionIds[0] ?? null,
      collectionIds: resolvedCollectionIds,
      documentId: resolvedDocumentIds[0] ?? null,
      documentIds: resolvedDocumentIds,
      permissionType: permissionType ?? undefined,
      groupId: groupId ?? null,
      teamId: user.teamId,
      createdById: user.id,
    });

    event.createdBy = user;
    if (group) {
      event.group = group;
    }

    ctx.body = {
      data: presentCalendarEvent(event),
      policies: presentPolicies(user, [event]),
    };
  }
);

router.post(
  "calendarEvents.update",
  rateLimiter(RateLimiterStrategy.TwentyFivePerMinute),
  auth(),
  validate(T.CalendarEventsUpdateSchema),
  transaction(),
  async (ctx: APIContext<T.CalendarEventsUpdateReq>) => {
    const { user } = ctx.state.auth;
    const {
      id,
      title,
      description,
      startAt,
      endAt,
      allDay,
      color,
      recurrenceFrequency,
      recurrenceEndAt,
      tags,
      assigneeIds,
      collectionId,
      collectionIds,
      documentId,
      documentIds,
      permissionType,
      groupId,
    } = ctx.input.body;

    const event = await CalendarEvent.findByPk(id);
    if (!event || event.teamId !== user.teamId) {
      throw NotFoundError();
    }

    authorize(user, "update", event);

    let nextAssigneeIds: string[] | undefined;
    if (assigneeIds !== undefined) {
      if (assigneeIds.length === 0) {
        nextAssigneeIds = [];
      } else {
        const validUsers = await User.findAll({
          attributes: ["id"],
          where: {
            id: uniq(assigneeIds),
            teamId: user.teamId,
          },
        });
        nextAssigneeIds = validUsers.map((u) => u.id);
      }
    }

    const nextCollectionIds =
      collectionIds !== undefined
        ? uniq(collectionIds)
        : collectionId !== undefined
          ? collectionId
            ? [collectionId]
            : []
          : undefined;

    const nextDocumentIds =
      documentIds !== undefined
        ? uniq(documentIds)
        : documentId !== undefined
          ? documentId
            ? [documentId]
            : []
          : undefined;

    if (nextCollectionIds) {
      for (const colId of nextCollectionIds) {
        const collection = await Collection.findByPk(colId, {
          userId: user.id,
        });
        authorize(user, "read", collection);
      }
    }

    if (nextDocumentIds) {
      for (const docId of nextDocumentIds) {
        const document = await Document.findByPk(docId, {
          userId: user.id,
        });
        authorize(user, "read", document);
      }
    }

    let group: Group | null = null;
    if (groupId) {
      group = await Group.findByPk(groupId, {
        include: [{ association: "groupUsers", required: false }],
      });
      authorize(user, "read", group);
    }

    if (title !== undefined) {
      event.title = title;
    }
    if (description !== undefined) {
      event.description = description;
    }
    if (startAt !== undefined) {
      event.startAt = startAt;
    }
    if (endAt !== undefined) {
      event.endAt = endAt;
    }
    if (allDay !== undefined) {
      event.allDay = allDay;
    }
    if (color !== undefined) {
      event.color = color;
    }
    if (recurrenceFrequency !== undefined) {
      event.recurrenceFrequency = recurrenceFrequency;
      if (!recurrenceFrequency) {
        event.recurrenceEndAt = null;
      }
    }
    if (recurrenceEndAt !== undefined && event.recurrenceFrequency) {
      event.recurrenceEndAt = recurrenceEndAt;
    }
    if (tags !== undefined) {
      event.tags = uniq(tags.map((t) => t.trim()).filter(Boolean));
    }
    if (nextAssigneeIds !== undefined) {
      event.assigneeIds = [...nextAssigneeIds];
    }
    if (nextCollectionIds !== undefined) {
      event.collectionIds = [...nextCollectionIds];
      event.collectionId = nextCollectionIds[0] ?? null;
    }
    if (nextDocumentIds !== undefined) {
      event.documentIds = [...nextDocumentIds];
      event.documentId = nextDocumentIds[0] ?? null;
    }
    if (permissionType !== undefined) {
      event.permissionType = permissionType;
    }
    if (groupId !== undefined) {
      event.groupId = groupId;
      event.group = group;
    }
    event.updatedById = user.id;

    await event.saveWithCtx(ctx);

    ctx.body = {
      data: presentCalendarEvent(event),
      policies: presentPolicies(user, [event]),
    };
  }
);

router.post(
  "calendarEvents.delete",
  rateLimiter(RateLimiterStrategy.TwentyFivePerMinute),
  auth(),
  validate(T.CalendarEventsDeleteSchema),
  transaction(),
  async (ctx: APIContext<T.CalendarEventsDeleteReq>) => {
    const { user } = ctx.state.auth;
    const { id } = ctx.input.body;

    const event = await CalendarEvent.findByPk(id);
    if (!event || event.teamId !== user.teamId) {
      throw NotFoundError();
    }

    authorize(user, "delete", event);

    await event.destroyWithCtx(ctx);

    ctx.body = {
      success: true,
    };
  }
);

router.post(
  "calendarEvents.settings",
  auth(),
  async (ctx: APIContext) => {
    const { user } = ctx.state.auth;
    const team = await Team.findByPk(user.teamId);
    if (!team) {
      throw NotFoundError();
    }

    const stored = (
      team.preferences as Record<string, unknown> | null | undefined
    )?.calendarSettings as Partial<CalendarWorkspaceSettings> | undefined;

    const settings: CalendarWorkspaceSettings = {
      ...DEFAULT_CALENDAR_SETTINGS,
      ...stored,
      categories:
        stored?.categories && Array.isArray(stored.categories)
          ? stored.categories
          : DEFAULT_CALENDAR_SETTINGS.categories,
    };

    ctx.body = {
      data: settings,
    };
  }
);

router.post(
  "calendarEvents.update_settings",
  rateLimiter(RateLimiterStrategy.TwentyFivePerMinute),
  auth(),
  validate(T.CalendarEventsUpdateSettingsSchema),
  transaction(),
  async (ctx: APIContext<T.CalendarEventsUpdateSettingsReq>) => {
    const { user } = ctx.state.auth;
    if (!user.isAdmin) {
      throw AuthorizationError();
    }

    const team = await Team.findByPk(user.teamId, {
      transaction: ctx.state.transaction,
    });
    if (!team) {
      throw NotFoundError();
    }

    authorize(user, "update", team);

    const nextSettings: CalendarWorkspaceSettings = {
      categories: ctx.input.body.categories.map((cat) => ({
        id: cat.id.trim(),
        name: cat.name.trim(),
        color: cat.color.trim(),
        tags: uniq(cat.tags.map((tItem) => tItem.trim()).filter(Boolean)),
      })),
      defaultPermissionType: ctx.input.body.defaultPermissionType,
      defaultColor: ctx.input.body.defaultColor,
      defaultViewMode: ctx.input.body.defaultViewMode,
      allowCustomTags: ctx.input.body.allowCustomTags,
      enableCaldavFeeds: ctx.input.body.enableCaldavFeeds,
    };

    team.preferences = {
      ...team.preferences,
      calendarSettings: nextSettings,
    } as typeof team.preferences;

    await team.saveWithCtx(ctx);

    ctx.body = {
      data: nextSettings,
    };
  }
);

router.post(
  "calendarEvents.feed_url",
  auth(),
  validate(T.CalendarEventsFeedUrlSchema),
  async (ctx: APIContext<T.CalendarEventsFeedUrlReq>) => {
    const { user } = ctx.state.auth;
    const filter = ctx.input.body.filter ?? "all";
    const { tags, includeUntagged } = ctx.input.body;
    const token = computeFeedToken(user.teamId, user.id);

    const params = new URLSearchParams({
      teamId: user.teamId,
      userId: user.id,
      token,
    });
    if (filter !== "all") {
      params.set("filter", filter);
    }
    if (tags !== undefined) {
      params.set("tags", tags.join(","));
    }
    if (includeUntagged !== undefined) {
      params.set("includeUntagged", includeUntagged ? "1" : "0");
    }

    const httpUrl = `${env.URL}/api/calendarEvents.ics?${params.toString()}`;
    const webcalUrl = httpUrl.replace(/^https?:\/\//i, "webcal://");

    ctx.body = {
      data: {
        httpUrl,
        webcalUrl,
      },
    };
  }
);

router.get(
  "calendarEvents.ics",
  validate(T.CalendarEventsIcsSchema),
  async (ctx: APIContext<T.CalendarEventsIcsReq>) => {
    const { teamId, userId, token, filter, tags, includeUntagged } =
      ctx.input.query;
    const expectedToken = computeFeedToken(teamId, userId);

    if (!safeEqual(token, expectedToken)) {
      throw AuthenticationError("Invalid calendar feed token");
    }

    const user = await User.findByPk(userId);
    if (!user || user.teamId !== teamId || user.isSuspended) {
      throw AuthenticationError("User not authorized for calendar feed");
    }

    const team = await Team.findByPk(teamId);
    const storedSettings = (
      team?.preferences as Record<string, unknown> | null | undefined
    )?.calendarSettings as Partial<CalendarWorkspaceSettings> | undefined;
    if (storedSettings?.enableCaldavFeeds === false) {
      throw AuthorizationError("CalDAV feeds are disabled for this workspace");
    }

    const where: Record<string | symbol, unknown> = { teamId };
    if (filter === "mine") {
      where.createdById = user.id;
    } else if (filter === "assigned") {
      where.assigneeIds = { [Op.contains]: [user.id] };
    }

    const allEvents = await CalendarEvent.findAll({
      where,
      order: [["startAt", "ASC"]],
    });

    const hasTagParam = tags !== undefined || includeUntagged !== undefined;
    const allowedTagSet = new Set(
      (tags ?? "")
        .split(",")
        .map((tItem) => tItem.trim().toLowerCase())
        .filter(Boolean)
    );
    const allowUntagged = includeUntagged !== "0" && includeUntagged !== "false";

    const events = hasTagParam
      ? allEvents.filter((ev) => {
          const evTags = ev.tags ?? [];
          if (evTags.length === 0) {
            return allowUntagged;
          }
          return evTags.some((tItem) =>
            allowedTagSet.has(tItem.trim().toLowerCase())
          );
        })
      : allEvents;

    const nowUtc = formatICalUTC(new Date());
    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Outline//Workspace Calendar//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Outline Workspace Calendar",
    ];

    for (const event of events) {
      const start = new Date(event.startAt);
      const end = new Date(event.endAt);

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${event.id}@outline.calendar`);
      lines.push(`DTSTAMP:${nowUtc}`);

      if (event.allDay) {
        const exclusiveEnd = addDays(
          new Date(end.getFullYear(), end.getMonth(), end.getDate()),
          1
        );
        lines.push(`DTSTART;VALUE=DATE:${format(start, "yyyyMMdd")}`);
        lines.push(`DTEND;VALUE=DATE:${format(exclusiveEnd, "yyyyMMdd")}`);
      } else {
        lines.push(`DTSTART:${formatICalUTC(start)}`);
        lines.push(`DTEND:${formatICalUTC(end)}`);
      }

      lines.push(`SUMMARY:${escapeICal(event.title)}`);

      if (event.description) {
        lines.push(`DESCRIPTION:${escapeICal(event.description)}`);
      }

      if (event.tags && event.tags.length > 0) {
        lines.push(
          `CATEGORIES:${event.tags.map((tag) => escapeICal(tag)).join(",")}`
        );
      }

      const rrule = buildEventRRule(event);
      if (rrule) {
        lines.push(rrule);
      }

      lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");

    ctx.set("Content-Type", "text/calendar; charset=utf-8");
    ctx.set(
      "Content-Disposition",
      'inline; filename="outline-calendar.ics"'
    );
    ctx.body = lines.join("\r\n");
  }
);

export default router;
