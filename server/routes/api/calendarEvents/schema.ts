import { z } from "zod";
import {
  CalendarEventPermissionType,
  CalendarEventRecurrenceFrequency,
} from "@shared/types";
import { CalendarEventValidation } from "@shared/validations";
import { BaseSchema } from "../schema";

export const CalendarEventsListSchema = BaseSchema.extend({
  body: z.object({
    startAt: z.coerce.date().optional(),
    endAt: z.coerce.date().optional(),
    collectionId: z.uuid().optional(),
    documentId: z.uuid().optional(),
    groupId: z.uuid().optional(),
  }),
});

export type CalendarEventsListReq = z.infer<typeof CalendarEventsListSchema>;

export const CalendarEventsInfoSchema = BaseSchema.extend({
  body: z.object({
    id: z.uuid(),
  }),
});

export type CalendarEventsInfoReq = z.infer<typeof CalendarEventsInfoSchema>;

export const CalendarEventsCreateSchema = BaseSchema.extend({
  body: z.object({
    title: z.string().trim().min(1).max(CalendarEventValidation.maxTitleLength),
    description: z
      .string()
      .max(CalendarEventValidation.maxDescriptionLength)
      .nullish(),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    allDay: z.boolean().optional(),
    color: z.string().max(32).nullish(),
    recurrenceFrequency: z
      .nativeEnum(CalendarEventRecurrenceFrequency)
      .nullish(),
    recurrenceEndAt: z.coerce.date().nullish(),
    tags: z.array(z.string().trim().min(1).max(64)).max(20).optional(),
    assigneeIds: z.array(z.uuid()).max(50).optional(),
    collectionId: z.uuid().nullish(),
    collectionIds: z.array(z.uuid()).optional(),
    documentId: z.uuid().nullish(),
    documentIds: z.array(z.uuid()).optional(),
    permissionType: z.nativeEnum(CalendarEventPermissionType).optional(),
    groupId: z.uuid().nullish(),
  }),
});

export type CalendarEventsCreateReq = z.infer<typeof CalendarEventsCreateSchema>;

export const CalendarEventsUpdateSchema = BaseSchema.extend({
  body: z.object({
    id: z.uuid(),
    title: z
      .string()
      .trim()
      .min(1)
      .max(CalendarEventValidation.maxTitleLength)
      .optional(),
    description: z
      .string()
      .max(CalendarEventValidation.maxDescriptionLength)
      .nullish(),
    startAt: z.coerce.date().optional(),
    endAt: z.coerce.date().optional(),
    allDay: z.boolean().optional(),
    color: z.string().max(32).nullish(),
    recurrenceFrequency: z
      .nativeEnum(CalendarEventRecurrenceFrequency)
      .nullish(),
    recurrenceEndAt: z.coerce.date().nullish(),
    tags: z.array(z.string().trim().min(1).max(64)).max(20).optional(),
    assigneeIds: z.array(z.uuid()).max(50).optional(),
    collectionId: z.uuid().nullish(),
    collectionIds: z.array(z.uuid()).optional(),
    documentId: z.uuid().nullish(),
    documentIds: z.array(z.uuid()).optional(),
    permissionType: z.nativeEnum(CalendarEventPermissionType).optional(),
    groupId: z.uuid().nullish(),
  }),
});

export type CalendarEventsUpdateReq = z.infer<typeof CalendarEventsUpdateSchema>;

export const CalendarEventsDeleteSchema = BaseSchema.extend({
  body: z.object({
    id: z.uuid(),
  }),
});

export type CalendarEventsDeleteReq = z.infer<typeof CalendarEventsDeleteSchema>;

export const CalendarEventsFeedUrlSchema = BaseSchema.extend({
  body: z.object({
    filter: z.enum(["all", "mine", "assigned"]).optional(),
    tags: z.array(z.string().trim().min(1).max(64)).max(100).optional(),
    includeUntagged: z.boolean().optional(),
  }),
});

export type CalendarEventsFeedUrlReq = z.infer<
  typeof CalendarEventsFeedUrlSchema
>;

export const CalendarEventsIcsSchema = BaseSchema.extend({
  query: z.object({
    teamId: z.uuid(),
    userId: z.uuid(),
    token: z.string().min(16),
    filter: z.enum(["all", "mine", "assigned"]).optional(),
    tags: z.string().optional(),
    includeUntagged: z.string().optional(),
  }),
});

export type CalendarEventsIcsReq = z.infer<typeof CalendarEventsIcsSchema>;

export const CalendarEventsUpdateSettingsSchema = BaseSchema.extend({
  body: z.object({
    categories: z
      .array(
        z.object({
          id: z.string().trim().min(1).max(64),
          name: z.string().trim().min(1).max(64),
          color: z.string().trim().min(1).max(32),
          tags: z.array(z.string().trim().min(1).max(64)).max(50),
        })
      )
      .max(30),
    defaultPermissionType: z.nativeEnum(CalendarEventPermissionType),
    defaultColor: z.string().trim().min(1).max(32),
    defaultViewMode: z.enum(["month", "list"]),
    allowCustomTags: z.boolean(),
    enableCaldavFeeds: z.boolean(),
  }),
});

export type CalendarEventsUpdateSettingsReq = z.infer<
  typeof CalendarEventsUpdateSettingsSchema
>;
