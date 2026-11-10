import {
  action,
  computed,
  makeObservable,
  observable,
  override,
  runInAction,
} from "mobx";
import {
  DEFAULT_CALENDAR_SETTINGS,
  type CalendarWorkspaceSettings,
} from "@shared/types";
import type { PartialExcept } from "~/types";
import CalendarEvent from "~/models/CalendarEvent";
import { client } from "~/utils/ApiClient";
import Store from "./base/Store";
import type RootStore from "./RootStore";

export interface CaldavSyncResult {
  imported: number;
  updated: number;
  pushed?: number;
  deleted?: number;
}

export default class CalendarEventsStore extends Store<CalendarEvent> {
  @observable
  public settings: CalendarWorkspaceSettings = DEFAULT_CALENDAR_SETTINGS;

  @observable
  public isSettingsLoaded = false;

  constructor(rootStore: RootStore) {
    super(rootStore, CalendarEvent);
    makeObservable(this);
  }

  /**
   * Fetches workspace calendar settings and categories.
   *
   * @returns A promise resolving to the workspace calendar settings.
   */
  @action
  public async fetchSettings(): Promise<CalendarWorkspaceSettings> {
    try {
      const res = await client.post(`/${this.apiEndpoint}.settings`, {});
      if (res?.data) {
        const loaded = res.data as CalendarWorkspaceSettings;
        runInAction(() => {
          this.settings = loaded;
          this.isSettingsLoaded = true;
        });
        return loaded;
      }
    } catch {
      // Fallback to default settings
    }
    return this.settings;
  }

  /**
   * Updates workspace calendar settings, categories, and CalDAV connections (admin only).
   *
   * @param nextSettings The updated calendar workspace settings.
   * @returns A promise resolving to the saved settings.
   */
  @action
  public async updateSettings(
    nextSettings: CalendarWorkspaceSettings
  ): Promise<CalendarWorkspaceSettings> {
    const res = await client.post(`/${this.apiEndpoint}.update_settings`, {
      categories: nextSettings.categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        color: cat.color,
        tags: [...cat.tags],
      })),
      defaultPermissionType: nextSettings.defaultPermissionType,
      defaultColor: nextSettings.defaultColor,
      defaultViewMode: nextSettings.defaultViewMode,
      allowCustomTags: nextSettings.allowCustomTags,
      enableCaldavFeeds: nextSettings.enableCaldavFeeds,
      caldavConnections: (nextSettings.caldavConnections ?? []).map((conn) => ({
        id: conn.id,
        name: conn.name,
        url: conn.url,
        username: conn.username ?? null,
        password: conn.password ?? null,
        defaultColor: conn.defaultColor,
        defaultTags: [...conn.defaultTags],
        syncDirection: conn.syncDirection,
        enabled: conn.enabled,
        lastSyncedAt: conn.lastSyncedAt ?? null,
        lastSyncStatus: conn.lastSyncStatus ?? null,
        syncedEventIds: conn.syncedEventIds ?? [],
      })),
    });
    const saved = (res?.data ?? nextSettings) as CalendarWorkspaceSettings;
    runInAction(() => {
      this.settings = saved;
      this.isSettingsLoaded = true;
    });
    return saved;
  }

  /**
   * Imports an `.ics` file/stream into the workspace calendar and maps its tags & color.
   *
   * @param params The `.ics` content and optional default tags/color mapping.
   * @returns A promise resolving to the import statistics.
   */
  @action
  public async importIcs({
    icsContent,
    defaultTags,
    defaultColor,
  }: {
    icsContent: string;
    defaultTags?: string[];
    defaultColor?: string;
  }): Promise<CaldavSyncResult> {
    const res = await client.post(`/${this.apiEndpoint}.import_ics`, {
      icsContent,
      defaultTags,
      defaultColor,
    });

    const stats = (res as unknown as { stats?: CaldavSyncResult })?.stats ?? {
      imported: 0,
      updated: 0,
    };

    runInAction(() => {
      if (res?.policies) {
        this.addPolicies(res.policies);
      }
      if (Array.isArray(res?.data)) {
        for (const item of res.data as PartialExcept<CalendarEvent, "id">[]) {
          this.add(item);
        }
      }
    });

    return stats;
  }

  /**
   * Synchronizes one or all configured CalDAV connections with the workspace calendar.
   *
   * @param connectionId Optional specific CalDAV connection ID to sync.
   * @returns A promise resolving to the sync statistics.
   */
  @action
  public async syncCaldav(connectionId?: string): Promise<CaldavSyncResult> {
    const res = await client.post(
      `/${this.apiEndpoint}.sync_caldav`,
      connectionId ? { connectionId } : {}
    );

    const typedRes = res as unknown as {
      data?: PartialExcept<CalendarEvent, "id">[];
      policies?: typeof res.policies;
      settings?: CalendarWorkspaceSettings;
      stats?: CaldavSyncResult;
    };

    runInAction(() => {
      if (typedRes?.policies) {
        this.addPolicies(typedRes.policies);
      }
      if (Array.isArray(typedRes?.data)) {
        for (const item of typedRes.data) {
          this.add(item);
        }
      }
      if (typedRes?.settings) {
        this.settings = typedRes.settings;
        this.isSettingsLoaded = true;
      }
    });

    return (
      typedRes?.stats ?? {
        imported: 0,
        updated: 0,
        pushed: 0,
        deleted: 0,
      }
    );
  }

  /**
   * Fetches calendar events overlapping the given date range.
   *
   * @param params Optional start and end bounds.
   * @returns A promise resolving to the fetched calendar events.
   */
  @action
  public async fetchForRange({
    startAt,
    endAt,
  }: {
    startAt?: string | Date;
    endAt?: string | Date;
  } = {}): Promise<CalendarEvent[]> {
    this.isFetching = true;

    try {
      const res = await client.post(`/${this.apiEndpoint}.list`, {
        startAt: startAt instanceof Date ? startAt.toISOString() : startAt,
        endAt: endAt instanceof Date ? endAt.toISOString() : endAt,
      });

      if (!res?.data) {
        return [];
      }

      return runInAction(() => {
        this.addPolicies(res.policies);
        this.isLoaded = true;
        return (res.data as PartialExcept<CalendarEvent, "id">[]).map((item) =>
          this.add(item)
        );
      });
    } finally {
      runInAction(() => {
        this.isFetching = false;
      });
    }
  }

  /**
   * Returns all calendar events ordered by start date ascending.
   */
  @override
  public get orderedData(): CalendarEvent[] {
    return Array.from(this.data.values()).sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    );
  }

  /**
   * Returns all calendar events sorted by start date ascending.
   */
  @computed
  public get events(): CalendarEvent[] {
    return this.orderedData;
  }
}
