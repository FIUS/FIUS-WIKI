export enum CalendarEventPermissionType {
  CreatorOrAdmin = "creator_or_admin",
  All = "all",
  Group = "group",
}

export enum CalendarEventRecurrenceFrequency {
  Daily = "daily",
  Weekdays = "weekdays",
  Weekly = "weekly",
  Biweekly = "biweekly",
  Monthly = "monthly",
  Yearly = "yearly",
}

export interface CalendarCategory {
  id: string;
  name: string;
  color: string;
  tags: string[];
}

export interface CalendarWorkspaceSettings {
  categories: CalendarCategory[];
  defaultPermissionType: CalendarEventPermissionType;
  defaultColor: string;
  defaultViewMode: "month" | "list";
  allowCustomTags: boolean;
  enableCaldavFeeds: boolean;
}

export const DEFAULT_CALENDAR_CATEGORIES: CalendarCategory[] = [
  {
    id: "cat-meetings",
    name: "Meetings & Syncs",
    color: "#0366d6",
    tags: ["Meeting", "Standup", "Workshop", "Retro"],
  },
  {
    id: "cat-product",
    name: "Product & Engineering",
    color: "#10B981",
    tags: ["Release", "Launch", "Sprint", "Maintenance"],
  },
  {
    id: "cat-deadlines",
    name: "Deadlines & Milestones",
    color: "#EF4444",
    tags: ["Deadline", "Milestone", "Review"],
  },
  {
    id: "cat-team",
    name: "Team & Availability",
    color: "#8B5CF6",
    tags: ["Out of Office", "Vacation", "Offsite"],
  },
];

export const DEFAULT_CALENDAR_SETTINGS: CalendarWorkspaceSettings = {
  categories: DEFAULT_CALENDAR_CATEGORIES,
  defaultPermissionType: CalendarEventPermissionType.CreatorOrAdmin,
  defaultColor: "#0366d6",
  defaultViewMode: "month",
  allowCustomTags: true,
  enableCaldavFeeds: true,
};

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  color: string | null;
  recurrenceFrequency: CalendarEventRecurrenceFrequency | null;
  recurrenceEndAt: string | null;
  tags: string[];
  assigneeIds: string[];
  collectionId: string | null;
  collectionIds: string[];
  documentId: string | null;
  documentIds: string[];
  permissionType: CalendarEventPermissionType;
  groupId: string | null;
  createdById: string;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
}
