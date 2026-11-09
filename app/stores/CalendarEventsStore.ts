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
   * Updates workspace calendar settings and categories (admin only).
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
    });
    const saved = (res?.data ?? nextSettings) as CalendarWorkspaceSettings;
    runInAction(() => {
      this.settings = saved;
      this.isSettingsLoaded = true;
    });
    return saved;
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
