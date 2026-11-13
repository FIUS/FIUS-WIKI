import crypto from "node:crypto";
import Router from "@koa/router";
import { addDays, format } from "date-fns";
import { uniq, uniqBy } from "es-toolkit/compat";
import { Op } from "sequelize";
import {
  CalendarEventPermissionType,
  CalendarEventRecurrenceFrequency,
  DEFAULT_CALENDAR_SETTINGS,
  type CalendarWorkspaceSettings,
} from "@shared/types";
import env from "@server/env";
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from "@server/errors";
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
import Logger from "@server/logging/Logger";
import { authorize } from "@server/policies";
import { presentCalendarEvent, presentPolicies } from "@server/presenters";
import type { APIContext } from "@server/types";
import {
  deleteEventFromCaldav,
  fetchRemoteCaldavEvents,
  parseICalendarEvents,
  pushEventToCaldav,
  resolveEventIdFromUid,
  type ParsedICalEvent,
} from "@server/utils/caldav";
import { safeEqual } from "@server/utils/crypto";
import { RateLimiterStrategy } from "@server/utils/RateLimiter";
import { afterCommit } from "@server/storage/transaction";
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

    const resolvedTags = uniq(
      (tags ?? []).map((t) => t.trim()).filter(Boolean)
    );
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

    void afterCommit(ctx.state.transaction, async () => {
      void syncEventOutboundToCaldav(user.teamId, event, "upsert");
    });

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

    void afterCommit(ctx.state.transaction, async () => {
      void syncEventOutboundToCaldav(user.teamId, event, "upsert");
    });

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

    void afterCommit(ctx.state.transaction, async () => {
      void syncEventOutboundToCaldav(user.teamId, event, "delete");
    });

    ctx.body = {
      success: true,
    };
  }
);

/**
 * Synchronizes an event change outbound to all bidirectional CalDAV connections.
 *
 * @param teamId The team ID.
 * @param event The calendar event.
 * @param action The sync action ("upsert" | "delete").
 * @returns Resolves when sync finishes.
 */
async function syncEventOutboundToCaldav(
  teamId: string,
  event: CalendarEvent,
  action: "upsert" | "delete"
): Promise<void> {
  try {
    const team = await Team.findByPk(teamId);
    if (!team) {
      return;
    }

    const stored = (
      team.preferences as Record<string, unknown> | null | undefined
    )?.calendarSettings as Partial<CalendarWorkspaceSettings> | undefined;

    const connections = stored?.caldavConnections;
    if (
      !connections ||
      !Array.isArray(connections) ||
      connections.length === 0
    ) {
      return;
    }

    let modified = false;

    for (const conn of connections) {
      if (!conn.enabled || conn.syncDirection !== "bidirectional") {
        continue;
      }

      const connTagSet = new Set(
        (conn.defaultTags ?? []).map((t) => t.trim().toLowerCase())
      );
      const matchesTags =
        connTagSet.size === 0 ||
        (event.tags ?? []).some((t) => connTagSet.has(t.trim().toLowerCase()));

      const remoteMeta = conn.remoteEventMeta?.[event.id];

      if (action === "delete") {
        if (remoteMeta || (conn.syncedEventIds ?? []).includes(event.id)) {
          await deleteEventFromCaldav(conn, event, remoteMeta);
          if (conn.syncedEventIds) {
            conn.syncedEventIds = conn.syncedEventIds.filter(
              (id) => id !== event.id
            );
          }
          if (conn.remoteEventMeta) {
            delete conn.remoteEventMeta[event.id];
          }
          modified = true;
        }
        continue;
      }

      // Action is upsert
      if (!matchesTags) {
        if (remoteMeta || (conn.syncedEventIds ?? []).includes(event.id)) {
          await deleteEventFromCaldav(conn, event, remoteMeta);
          if (conn.syncedEventIds) {
            conn.syncedEventIds = conn.syncedEventIds.filter(
              (id) => id !== event.id
            );
          }
          if (conn.remoteEventMeta) {
            delete conn.remoteEventMeta[event.id];
          }
          modified = true;
        }
        continue;
      }

      const pushRes = await pushEventToCaldav(conn, event, remoteMeta);
      if (pushRes.success) {
        conn.syncedEventIds = uniq([...(conn.syncedEventIds ?? []), event.id]);
        conn.remoteEventMeta = {
          ...conn.remoteEventMeta,
          [event.id]: {
            uid: remoteMeta?.uid || `${event.id}@outline.calendar`,
            href: remoteMeta?.href ?? null,
            etag: pushRes.etag ?? remoteMeta?.etag ?? null,
            lastSyncedAt: new Date().toISOString(),
          },
        };
        conn.lastSyncedAt = new Date().toISOString();
        conn.lastSyncStatus = "ok";
        modified = true;
      } else {
        conn.lastSyncStatus = pushRes.error ?? "Push failed";
        modified = true;
      }
    }

    if (modified) {
      team.preferences = {
        ...team.preferences,
        calendarSettings: {
          ...stored,
          caldavConnections: connections,
        },
      } as typeof team.preferences;
      await team.save();
    }
  } catch (err) {
    Logger.error(
      "Failed to sync calendar event outbound to CalDAV",
      err as Error,
      {
        teamId,
        eventId: event.id,
        action,
      }
    );
  }
}

async function upsertParsedEventsForTeam(
  ctx: APIContext,
  user: User,
  parsedEvents: ParsedICalEvent[],
  options: {
    defaultTags?: string[];
    defaultColor?: string;
    defaultPermissionType?: CalendarEventPermissionType;
  }
): Promise<{
  events: CalendarEvent[];
  imported: number;
  updated: number;
  syncedIds: string[];
}> {
  const teamUsers = await User.findAll({
    where: { teamId: user.teamId },
    transaction: ctx.state.transaction,
  });

  const userByEmail = new Map<string, string>();
  const userByName = new Map<string, string>();
  for (const member of teamUsers) {
    if (member.email) {
      userByEmail.set(member.email.trim().toLowerCase(), member.id);
    }
    userByName.set(member.name.trim().toLowerCase(), member.id);
  }

  const upsertedEvents: CalendarEvent[] = [];
  const syncedIds: string[] = [];
  let imported = 0;
  let updated = 0;

  for (const parsed of parsedEvents) {
    const eventId = resolveEventIdFromUid(user.teamId, parsed.uid);
    syncedIds.push(eventId);

    const mergedTags = uniq(
      [...(options.defaultTags ?? []), ...parsed.tags]
        .map((tItem) => tItem.trim())
        .filter(Boolean)
    ).slice(0, 20);

    const matchedAssigneeIds: string[] = [];
    for (const email of parsed.attendeeEmails) {
      const uid = userByEmail.get(email.toLowerCase());
      if (uid) {
        matchedAssigneeIds.push(uid);
      }
    }
    for (const name of parsed.attendeeNames) {
      const uid = userByName.get(name.toLowerCase());
      if (uid) {
        matchedAssigneeIds.push(uid);
      }
    }
    const resolvedAssigneeIds = uniq(matchedAssigneeIds);

    const existing = await CalendarEvent.findOne({
      where: { id: eventId, teamId: user.teamId },
      transaction: ctx.state.transaction,
    });

    if (existing) {
      existing.title = parsed.title.slice(0, 255);
      existing.description = parsed.description;
      existing.startAt = parsed.startAt;
      existing.endAt = parsed.endAt;
      existing.allDay = parsed.allDay;
      if (options.defaultColor && !existing.color) {
        existing.color = options.defaultColor;
      }
      existing.recurrenceFrequency = parsed.recurrenceFrequency;
      existing.recurrenceEndAt = parsed.recurrenceEndAt;
      existing.tags = uniq([...(existing.tags ?? []), ...mergedTags]).slice(
        0,
        20
      );
      if (resolvedAssigneeIds.length > 0) {
        existing.assigneeIds = uniq([
          ...(existing.assigneeIds ?? []),
          ...resolvedAssigneeIds,
        ]);
      }
      existing.updatedById = user.id;
      await existing.saveWithCtx(ctx);
      upsertedEvents.push(existing);
      updated += 1;
    } else {
      const created = await CalendarEvent.createWithCtx(ctx, {
        id: eventId,
        teamId: user.teamId,
        title: parsed.title.slice(0, 255),
        description: parsed.description,
        startAt: parsed.startAt,
        endAt: parsed.endAt,
        allDay: parsed.allDay,
        color: options.defaultColor ?? "#0366d6",
        recurrenceFrequency: parsed.recurrenceFrequency,
        recurrenceEndAt: parsed.recurrenceEndAt,
        tags: mergedTags,
        assigneeIds: resolvedAssigneeIds,
        collectionId: null,
        collectionIds: [],
        documentId: null,
        documentIds: [],
        permissionType:
          options.defaultPermissionType ?? CalendarEventPermissionType.All,
        groupId: null,
        createdById: user.id,
        updatedById: user.id,
      });
      upsertedEvents.push(created);
      imported += 1;
    }
  }

  return { events: upsertedEvents, imported, updated, syncedIds };
}

router.post("calendarEvents.settings", auth(), async (ctx: APIContext) => {
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
    caldavConnections:
      stored?.caldavConnections && Array.isArray(stored.caldavConnections)
        ? stored.caldavConnections
        : [],
  };

  ctx.body = {
    data: settings,
  };
});

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

    const existingSettings = (
      team.preferences as Record<string, unknown> | null | undefined
    )?.calendarSettings as Partial<CalendarWorkspaceSettings> | undefined;

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
      caldavConnections:
        ctx.input.body.caldavConnections ??
        existingSettings?.caldavConnections ??
        [],
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
  "calendarEvents.import_ics",
  rateLimiter(RateLimiterStrategy.TenPerMinute),
  auth(),
  validate(T.CalendarEventsImportIcsSchema),
  transaction(),
  async (ctx: APIContext<T.CalendarEventsImportIcsReq>) => {
    const { user } = ctx.state.auth;
    const { icsContent, defaultTags, defaultColor } = ctx.input.body;

    const parsedEvents = parseICalendarEvents(icsContent);
    if (parsedEvents.length === 0) {
      throw ValidationError("No valid VEVENT entries found in .ics content");
    }

    const result = await upsertParsedEventsForTeam(ctx, user, parsedEvents, {
      defaultTags,
      defaultColor,
    });

    ctx.body = {
      data: result.events.map(presentCalendarEvent),
      policies: presentPolicies(user, result.events),
      stats: {
        imported: result.imported,
        updated: result.updated,
      },
    };
  }
);

router.post(
  "calendarEvents.sync_caldav",
  rateLimiter(RateLimiterStrategy.TenPerMinute),
  auth(),
  validate(T.CalendarEventsSyncCaldavSchema),
  transaction(),
  async (ctx: APIContext<T.CalendarEventsSyncCaldavReq>) => {
    const { user } = ctx.state.auth;
    const { connectionId } = ctx.input.body;

    const team = await Team.findByPk(user.teamId, {
      transaction: ctx.state.transaction,
    });
    if (!team) {
      throw NotFoundError();
    }

    const stored = (
      team.preferences as Record<string, unknown> | null | undefined
    )?.calendarSettings as Partial<CalendarWorkspaceSettings> | undefined;

    const currentSettings: CalendarWorkspaceSettings = {
      ...DEFAULT_CALENDAR_SETTINGS,
      ...stored,
      categories:
        stored?.categories && Array.isArray(stored.categories)
          ? stored.categories
          : DEFAULT_CALENDAR_SETTINGS.categories,
      caldavConnections:
        stored?.caldavConnections && Array.isArray(stored.caldavConnections)
          ? stored.caldavConnections.map((c) => ({ ...c }))
          : [],
    };

    const targetConnections = (currentSettings.caldavConnections ?? []).filter(
      (c) => (connectionId ? c.id === connectionId : c.enabled)
    );

    if (targetConnections.length === 0) {
      throw ValidationError("No active CalDAV connections found to sync");
    }

    const teamUsers = await User.findAll({
      where: { teamId: user.teamId },
      transaction: ctx.state.transaction,
    });

    const userByEmail = new Map<string, string>();
    const userByName = new Map<string, string>();
    for (const member of teamUsers) {
      if (member.email) {
        userByEmail.set(member.email.trim().toLowerCase(), member.id);
      }
      userByName.set(member.name.trim().toLowerCase(), member.id);
    }

    let totalImported = 0;
    let totalUpdated = 0;
    let totalPushed = 0;
    let totalDeleted = 0;
    const allSyncedEvents: CalendarEvent[] = [];

    for (const conn of targetConnections) {
      try {
        const remoteEvents = await fetchRemoteCaldavEvents(conn);
        const remoteEventMap = new Map<string, ParsedICalEvent>();
        for (const parsed of remoteEvents) {
          const eventId = resolveEventIdFromUid(user.teamId, parsed.uid);
          remoteEventMap.set(eventId, parsed);
        }

        const localEvents = await CalendarEvent.findAll({
          where: { teamId: user.teamId },
          transaction: ctx.state.transaction,
        });
        const localEventMap = new Map<string, CalendarEvent>();
        for (const ev of localEvents) {
          localEventMap.set(ev.id, ev);
        }

        const previousSyncedIds = new Set(conn.syncedEventIds ?? []);
        const remoteMetaMap = { ...conn.remoteEventMeta };
        const nextSyncedIds = new Set<string>();
        const connTagSet = new Set(
          (conn.defaultTags ?? []).map((t) => t.trim().toLowerCase())
        );

        // Step 1: Process remote events
        for (const [eventId, parsed] of remoteEventMap.entries()) {
          const matchedAssigneeIds: string[] = [];
          for (const email of parsed.attendeeEmails) {
            const uid = userByEmail.get(email.toLowerCase());
            if (uid) {
              matchedAssigneeIds.push(uid);
            }
          }
          for (const name of parsed.attendeeNames) {
            const uid = userByName.get(name.toLowerCase());
            if (uid) {
              matchedAssigneeIds.push(uid);
            }
          }
          const resolvedAssigneeIds = uniq(matchedAssigneeIds);
          const mergedTags = uniq(
            [...(conn.defaultTags ?? []), ...parsed.tags]
              .map((t) => t.trim())
              .filter(Boolean)
          ).slice(0, 20);

          const local = localEventMap.get(eventId);

          if (local) {
            const localTime = local.updatedAt
              ? new Date(local.updatedAt).getTime()
              : 0;
            const remoteTime = parsed.lastModifiedAt
              ? new Date(parsed.lastModifiedAt).getTime()
              : 0;

            if (
              conn.syncDirection === "bidirectional" &&
              localTime > remoteTime + 2000
            ) {
              // Local is newer: push to CalDAV
              const pushRes = await pushEventToCaldav(conn, local, {
                uid: parsed.uid,
                href: parsed.href ?? remoteMetaMap[eventId]?.href,
                etag: parsed.etag ?? remoteMetaMap[eventId]?.etag,
              });

              if (!pushRes.success) {
                throw new Error(
                  `Failed pushing event "${local.title}" to CalDAV: ${pushRes.error}`
                );
              }

              remoteMetaMap[eventId] = {
                uid: parsed.uid,
                href: parsed.href ?? remoteMetaMap[eventId]?.href ?? null,
                etag:
                  pushRes.etag ??
                  parsed.etag ??
                  remoteMetaMap[eventId]?.etag ??
                  null,
                lastSyncedAt: new Date().toISOString(),
              };
              totalPushed += 1;
              nextSyncedIds.add(eventId);
              allSyncedEvents.push(local);
            } else if (
              remoteTime > localTime + 2000 ||
              conn.syncDirection === "import_only"
            ) {
              // Remote is newer: update local Outline event
              local.title = parsed.title.slice(0, 255);
              local.description = parsed.description;
              local.startAt = parsed.startAt;
              local.endAt = parsed.endAt;
              local.allDay = parsed.allDay;
              if (conn.defaultColor && !local.color) {
                local.color = conn.defaultColor;
              }
              local.recurrenceFrequency = parsed.recurrenceFrequency;
              local.recurrenceEndAt = parsed.recurrenceEndAt;
              local.tags = uniq([...(local.tags ?? []), ...mergedTags]).slice(
                0,
                20
              );
              if (resolvedAssigneeIds.length > 0) {
                local.assigneeIds = uniq([
                  ...(local.assigneeIds ?? []),
                  ...resolvedAssigneeIds,
                ]);
              }
              local.updatedById = user.id;

              await local.saveWithCtx(ctx);

              remoteMetaMap[eventId] = {
                uid: parsed.uid,
                href: parsed.href ?? remoteMetaMap[eventId]?.href ?? null,
                etag: parsed.etag ?? remoteMetaMap[eventId]?.etag ?? null,
                lastSyncedAt: new Date().toISOString(),
              };
              totalUpdated += 1;
              nextSyncedIds.add(eventId);
              allSyncedEvents.push(local);
            } else {
              // Both sides are equal
              remoteMetaMap[eventId] = {
                uid: parsed.uid,
                href: parsed.href ?? remoteMetaMap[eventId]?.href ?? null,
                etag: parsed.etag ?? remoteMetaMap[eventId]?.etag ?? null,
                lastSyncedAt: new Date().toISOString(),
              };
              nextSyncedIds.add(eventId);
              allSyncedEvents.push(local);
            }
          } else {
            // Local does not exist
            if (
              previousSyncedIds.has(eventId) &&
              conn.syncDirection === "bidirectional"
            ) {
              // Deleted in Outline -> delete on CalDAV server
              await deleteEventFromCaldav(
                conn,
                { id: eventId },
                {
                  uid: parsed.uid,
                  href: parsed.href ?? remoteMetaMap[eventId]?.href,
                }
              );
              delete remoteMetaMap[eventId];
              totalDeleted += 1;
            } else {
              // New remote event -> import to Outline
              const created = await CalendarEvent.createWithCtx(ctx, {
                id: eventId,
                teamId: user.teamId,
                title: parsed.title.slice(0, 255),
                description: parsed.description,
                startAt: parsed.startAt,
                endAt: parsed.endAt,
                allDay: parsed.allDay,
                color:
                  conn.defaultColor ||
                  currentSettings.defaultColor ||
                  "#0366d6",
                recurrenceFrequency: parsed.recurrenceFrequency,
                recurrenceEndAt: parsed.recurrenceEndAt,
                tags: mergedTags,
                assigneeIds: resolvedAssigneeIds,
                collectionId: null,
                collectionIds: [],
                documentId: null,
                documentIds: [],
                permissionType:
                  currentSettings.defaultPermissionType ??
                  CalendarEventPermissionType.All,
                groupId: null,
                createdById: user.id,
                updatedById: user.id,
              });

              localEventMap.set(created.id, created);
              remoteMetaMap[eventId] = {
                uid: parsed.uid,
                href: parsed.href ?? null,
                etag: parsed.etag ?? null,
                lastSyncedAt: new Date().toISOString(),
              };
              totalImported += 1;
              nextSyncedIds.add(eventId);
              allSyncedEvents.push(created);
            }
          }
        }

        // Step 2: Process local events not found in remote
        for (const [eventId, local] of localEventMap.entries()) {
          if (remoteEventMap.has(eventId)) {
            continue;
          }

          if (previousSyncedIds.has(eventId)) {
            // Deleted on remote CalDAV server
            await local.destroyWithCtx(ctx);
            delete remoteMetaMap[eventId];
            localEventMap.delete(eventId);
            totalDeleted += 1;
            continue;
          }

          // New local event created in Outline
          if (conn.syncDirection === "bidirectional") {
            const matchesTags =
              connTagSet.size === 0 ||
              (local.tags ?? []).some((t) =>
                connTagSet.has(t.trim().toLowerCase())
              );

            if (matchesTags) {
              const pushRes = await pushEventToCaldav(conn, local);
              if (!pushRes.success) {
                throw new Error(
                  `Failed pushing event "${local.title}" to CalDAV: ${pushRes.error}`
                );
              }

              remoteMetaMap[local.id] = {
                uid: `${local.id}@outline.calendar`,
                href: null,
                etag: pushRes.etag ?? null,
                lastSyncedAt: new Date().toISOString(),
              };
              nextSyncedIds.add(local.id);
              totalPushed += 1;
              allSyncedEvents.push(local);
            }
          }
        }

        conn.syncedEventIds = Array.from(nextSyncedIds);
        conn.remoteEventMeta = remoteMetaMap;
        conn.lastSyncedAt = new Date().toISOString();
        conn.lastSyncStatus = "ok";
      } catch (err) {
        conn.lastSyncedAt = new Date().toISOString();
        conn.lastSyncStatus =
          err instanceof Error ? err.message : "Sync failed";
        throw ValidationError(
          `CalDAV sync failed for "${conn.name}": ${conn.lastSyncStatus}`
        );
      }
    }

    team.preferences = {
      ...team.preferences,
      calendarSettings: currentSettings,
    } as typeof team.preferences;
    await team.saveWithCtx(ctx);

    const presentedEvents = uniqBy(allSyncedEvents, (e) => e.id);

    ctx.body = {
      data: presentedEvents.map(presentCalendarEvent),
      policies: presentPolicies(user, presentedEvents),
      settings: currentSettings,
      stats: {
        imported: totalImported,
        updated: totalUpdated,
        pushed: totalPushed,
        deleted: totalDeleted,
      },
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
    const allowUntagged =
      includeUntagged !== "0" && includeUntagged !== "false";

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
    ctx.set("Content-Disposition", 'inline; filename="outline-calendar.ics"');
    ctx.body = lines.join("\r\n");
  }
);

export default router;
