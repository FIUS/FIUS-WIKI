import type { CalendarEvent } from "@server/models";
import presentUser from "./user";

/**
 * Presents a calendar event for the API response.
 *
 * @param event - The calendar event to present.
 * @returns The presented calendar event object.
 */
export default function presentCalendarEvent(event: CalendarEvent) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    startAt:
      event.startAt instanceof Date
        ? event.startAt.toISOString()
        : new Date(event.startAt).toISOString(),
    endAt:
      event.endAt instanceof Date
        ? event.endAt.toISOString()
        : new Date(event.endAt).toISOString(),
    allDay: event.allDay,
    color: event.color,
    recurrenceFrequency: event.recurrenceFrequency ?? null,
    recurrenceEndAt: event.recurrenceEndAt
      ? event.recurrenceEndAt instanceof Date
        ? event.recurrenceEndAt.toISOString()
        : new Date(event.recurrenceEndAt).toISOString()
      : null,
    tags: event.tags ?? [],
    assigneeIds: event.assigneeIds ?? [],
    collectionId: event.collectionIds?.[0] ?? event.collectionId ?? null,
    collectionIds: event.collectionIds?.length
      ? event.collectionIds
      : event.collectionId
        ? [event.collectionId]
        : [],
    documentId: event.documentIds?.[0] ?? event.documentId ?? null,
    documentIds: event.documentIds?.length
      ? event.documentIds
      : event.documentId
        ? [event.documentId]
        : [],
    permissionType: event.permissionType,
    groupId: event.groupId,
    createdById: event.createdById,
    ...(event.createdBy ? { createdBy: presentUser(event.createdBy) } : {}),
    updatedById: event.updatedById,
    createdAt:
      event.createdAt instanceof Date
        ? event.createdAt.toISOString()
        : new Date(event.createdAt).toISOString(),
    updatedAt:
      event.updatedAt instanceof Date
        ? event.updatedAt.toISOString()
        : new Date(event.updatedAt).toISOString(),
  };
}
