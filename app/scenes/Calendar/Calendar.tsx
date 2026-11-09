import { observer } from "mobx-react";
import * as React from "react";
import {
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
} from "date-fns";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import styled from "styled-components";
import { DynamicCalendarIcon } from "@shared/components/DynamicCalendarIcon";
import Scene from "~/components/Scene";
import useStores from "~/hooks/useStores";
import type CalendarEvent from "~/models/CalendarEvent";
import CalendarCategoriesSidebar from "./components/CalendarCategoriesSidebar";
import CalendarEventDetailModal from "./components/CalendarEventDetailModal";
import CalendarEventModal from "./components/CalendarEventModal";
import CalendarHeader, {
  type CalendarFilterMode,
  type CalendarViewMode,
} from "./components/CalendarHeader";
import CalendarListView from "./components/CalendarListView";
import CalendarMonthView from "./components/CalendarMonthView";
import CalendarSubscriptionModal from "./components/CalendarSubscriptionModal";
import { downloadICalendar } from "./utils/ical";
import { doesEventOccurOnDay } from "./utils/recurrence";

const CalendarWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  max-width: 1520px;
  margin: 8px auto 0;
  padding-bottom: 40px;
`;

const MainContentRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 20px;
  width: 100%;

  @media (max-width: 1024px) {
    flex-direction: column;
  }
`;

const PrimaryCalendarArea = styled.div`
  flex: 1;
  min-width: 0;
  width: 100%;
`;

/**
 * Global Calendar scene displaying workspace events in a monthly grid or agenda list view,
 * with a right-hand categories & tags visibility and export sidebar.
 *
 * @returns The rendered Calendar scene component.
 */
function Calendar() {
  const { t } = useTranslation();
  const { auth, calendarEvents, collections, documents, users } = useStores();

  const [today] = React.useState<Date>(() => new Date());
  const [currentMonth, setCurrentMonth] = React.useState<Date>(
    () => new Date()
  );
  const [viewMode, setViewMode] = React.useState<CalendarViewMode>(
    () => calendarEvents.settings.defaultViewMode ?? "month"
  );
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filterMode, setFilterMode] = React.useState<CalendarFilterMode>("all");
  const [selectedColor, setSelectedColor] = React.useState<string | null>(null);
  const [selectedTag, setSelectedTag] = React.useState<string | null>(null);

  // Right-hand sidebar visibility state
  const [hiddenTags, setHiddenTags] = React.useState<Set<string>>(
    () => new Set()
  );
  const [showUntagged, setShowUntagged] = React.useState<boolean>(true);

  const [isEventModalOpen, setIsEventModalOpen] = React.useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = React.useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] =
    React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] =
    React.useState<CalendarEvent | null>(null);
  const [editingEvent, setEditingEvent] = React.useState<CalendarEvent | null>(
    null
  );

  React.useEffect(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    void calendarEvents.fetchForRange({ startAt: start, endAt: end });
  }, [currentMonth, calendarEvents]);

  React.useEffect(() => {
    void users.fetchPage({ limit: 100 });
    void calendarEvents.fetchSettings().then((loaded) => {
      if (loaded.defaultViewMode) {
        setViewMode(loaded.defaultViewMode);
      }
    });
  }, [users, calendarEvents]);

  const handlePrevMonth = React.useCallback(() => {
    setCurrentMonth((prev) => subMonths(prev, 1));
  }, []);

  const handleNextMonth = React.useCallback(() => {
    setCurrentMonth((prev) => addMonths(prev, 1));
  }, []);

  const handleToday = React.useCallback(() => {
    setCurrentMonth(new Date());
  }, []);

  const handleNewEvent = React.useCallback(() => {
    setSelectedDate(new Date());
    setEditingEvent(null);
    setIsEventModalOpen(true);
  }, []);

  const handleSelectDate = React.useCallback((date: Date) => {
    setSelectedDate(date);
    setEditingEvent(null);
    setIsEventModalOpen(true);
  }, []);

  const handleSelectEvent = React.useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsDetailModalOpen(true);
  }, []);

  const handleEditEvent = React.useCallback((event: CalendarEvent) => {
    setIsDetailModalOpen(false);
    setEditingEvent(event);
    setIsEventModalOpen(true);
  }, []);

  const handleCloseEventModal = React.useCallback(() => {
    setIsEventModalOpen(false);
    setEditingEvent(null);
  }, []);

  const handleCloseDetailModal = React.useCallback(() => {
    setIsDetailModalOpen(false);
    setSelectedEvent(null);
  }, []);

  const handleOpenSubscriptionModal = React.useCallback(() => {
    setIsSubscriptionModalOpen(true);
  }, []);

  const handleCloseSubscriptionModal = React.useCallback(() => {
    setIsSubscriptionModalOpen(false);
  }, []);

  const handleClearFilters = React.useCallback(() => {
    setSearchQuery("");
    setFilterMode("all");
    setSelectedColor(null);
    setSelectedTag(null);
    setHiddenTags(new Set());
    setShowUntagged(true);
  }, []);

  const todayDay = today.getDate();
  const allEvents = calendarEvents.events;
  const currentUserId = auth.user?.id;
  const isAdmin = Boolean(auth.user?.isAdmin);
  const categories = calendarEvents.settings.categories;

  // Compute all known tags (configured categories + custom event tags) & counts
  const {
    availableTags,
    uncategorizedTags,
    tagCounts,
    untaggedCount,
    allKnownTags,
  } = React.useMemo(() => {
    const configuredLowerSet = new Set<string>();
    const canonicalMap = new Map<string, string>();

    for (const cat of categories) {
      for (const tag of cat.tags) {
        const lower = tag.trim().toLowerCase();
        if (lower) {
          configuredLowerSet.add(lower);
          if (!canonicalMap.has(lower)) {
            canonicalMap.set(lower, tag.trim());
          }
        }
      }
    }

    const counts = new Map<string, number>();
    let untagged = 0;
    const uncategorizedMap = new Map<string, string>();

    for (const ev of allEvents) {
      const evTags = ev.tags ?? [];
      if (evTags.length === 0) {
        untagged += 1;
        continue;
      }
      for (const rawTag of evTags) {
        const cleaned = rawTag.trim();
        const lower = cleaned.toLowerCase();
        if (!lower) {
          continue;
        }
        counts.set(lower, (counts.get(lower) ?? 0) + 1);
        if (!canonicalMap.has(lower)) {
          canonicalMap.set(lower, cleaned);
        }
        if (!configuredLowerSet.has(lower) && !uncategorizedMap.has(lower)) {
          uncategorizedMap.set(lower, cleaned);
        }
      }
    }

    return {
      availableTags: Array.from(canonicalMap.values()).sort((a, b) =>
        a.localeCompare(b)
      ),
      uncategorizedTags: Array.from(uncategorizedMap.values()).sort((a, b) =>
        a.localeCompare(b)
      ),
      tagCounts: counts,
      untaggedCount: untagged,
      allKnownTags: Array.from(canonicalMap.values()),
    };
  }, [categories, allEvents]);

  const handleToggleTag = React.useCallback((tag: string) => {
    const lower = tag.toLowerCase();
    setHiddenTags((prev) => {
      const next = new Set(prev);
      if (next.has(lower)) {
        next.delete(lower);
      } else {
        next.add(lower);
      }
      return next;
    });
  }, []);

  const handleToggleCategory = React.useCallback((tags: string[]) => {
    setHiddenTags((prev) => {
      const next = new Set(prev);
      const lowers = tags.map((tItem) => tItem.toLowerCase());
      const allCurrentlyVisible = lowers.every((l) => !next.has(l));
      if (allCurrentlyVisible) {
        for (const l of lowers) {
          next.add(l);
        }
      } else {
        for (const l of lowers) {
          next.delete(l);
        }
      }
      return next;
    });
  }, []);

  const handleToggleUntagged = React.useCallback(() => {
    setShowUntagged((prev) => !prev);
  }, []);

  const handleSelectAllSidebar = React.useCallback(() => {
    setHiddenTags(new Set());
    setShowUntagged(true);
  }, []);

  const handleSelectNoneSidebar = React.useCallback(() => {
    setHiddenTags(new Set(allKnownTags.map((tItem) => tItem.toLowerCase())));
    setShowUntagged(false);
  }, [allKnownTags]);

  const visibleTags = React.useMemo(
    () =>
      allKnownTags.filter((tag) => !hiddenTags.has(tag.toLowerCase())),
    [allKnownTags, hiddenTags]
  );

  const hasSidebarFilter = hiddenTags.size > 0 || !showUntagged;

  const filteredEvents = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return allEvents.filter((event) => {
      // Right-hand sidebar category/tag visibility check
      const evTags = event.tags ?? [];
      if (evTags.length === 0) {
        if (!showUntagged) {
          return false;
        }
      } else {
        const hasAtLeastOneVisibleTag = evTags.some(
          (tag) => !hiddenTags.has(tag.trim().toLowerCase())
        );
        if (!hasAtLeastOneVisibleTag) {
          return false;
        }
      }

      if (filterMode === "mine" && event.createdById !== currentUserId) {
        return false;
      }
      if (
        filterMode === "assigned" &&
        (!currentUserId || !(event.assigneeIds ?? []).includes(currentUserId))
      ) {
        return false;
      }
      if (filterMode === "recurring" && !event.recurrenceFrequency) {
        return false;
      }
      if (
        filterMode === "references" &&
        event.resolvedCollectionIds.length === 0 &&
        event.resolvedDocumentIds.length === 0
      ) {
        return false;
      }
      if (filterMode === "allDay" && !event.allDay) {
        return false;
      }
      if (
        selectedColor &&
        (event.color ?? "").toLowerCase() !== selectedColor.toLowerCase()
      ) {
        return false;
      }
      if (
        selectedTag &&
        !evTags.some(
          (tag) => tag.toLowerCase() === selectedTag.toLowerCase()
        )
      ) {
        return false;
      }

      if (query) {
        const titleMatch = event.title.toLowerCase().includes(query);
        const descMatch = (event.description ?? "")
          .toLowerCase()
          .includes(query);
        const creatorMatch = (event.createdBy?.name ?? "")
          .toLowerCase()
          .includes(query);
        const tagMatch = evTags.some((tag) =>
          tag.toLowerCase().includes(query)
        );
        const assigneeMatch = (event.assigneeIds ?? []).some((userId) =>
          (users.get(userId)?.name ?? "").toLowerCase().includes(query)
        );
        const collectionMatch = event.resolvedCollectionIds.some((colId) =>
          (collections.get(colId)?.displayName ?? "")
            .toLowerCase()
            .includes(query)
        );
        const docMatch = event.resolvedDocumentIds.some((docId) =>
          (documents.get(docId)?.displayTitle ?? "")
            .toLowerCase()
            .includes(query)
        );

        if (
          !titleMatch &&
          !descMatch &&
          !creatorMatch &&
          !tagMatch &&
          !assigneeMatch &&
          !collectionMatch &&
          !docMatch
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    allEvents,
    showUntagged,
    hiddenTags,
    filterMode,
    currentUserId,
    selectedColor,
    selectedTag,
    searchQuery,
    collections,
    documents,
    users,
  ]);

  const monthEvents = React.useMemo(() => {
    const mStart = startOfMonth(currentMonth);
    const mEnd = endOfMonth(currentMonth);
    const daysInMonth = eachDayOfInterval({ start: mStart, end: mEnd });
    return filteredEvents.filter((event) =>
      daysInMonth.some((day) => doesEventOccurOnDay(event, day))
    );
  }, [filteredEvents, currentMonth]);

  const handleExportICal = React.useCallback(() => {
    if (monthEvents.length === 0) {
      toast.info(t("No events in the current selection to export."));
      return;
    }

    const filename = `outline-calendar-${format(currentMonth, "yyyy-MM")}.ics`;
    downloadICalendar(monthEvents, filename);
    toast.success(
      t("Exported {{count}} selected events as iCal (.ics).", {
        count: monthEvents.length,
      })
    );
  }, [monthEvents, currentMonth, t]);

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    filterMode !== "all" ||
    selectedColor !== null ||
    selectedTag !== null ||
    hasSidebarFilter;

  return (
    <Scene
      icon={<DynamicCalendarIcon day={todayDay} />}
      title={t("Calendar")}
      wide
    >
      <CalendarWrapper>
        <CalendarHeader
          currentMonth={currentMonth}
          eventCount={monthEvents.length}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterMode={filterMode}
          onFilterModeChange={setFilterMode}
          selectedColor={selectedColor}
          onColorChange={setSelectedColor}
          availableTags={availableTags}
          selectedTag={selectedTag}
          onTagChange={setSelectedTag}
          onClearFilters={handleClearFilters}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onToday={handleToday}
          onNewEvent={handleNewEvent}
          onOpenSubscriptionModal={handleOpenSubscriptionModal}
        />

        <MainContentRow>
          <PrimaryCalendarArea>
            {viewMode === "month" ? (
              <CalendarMonthView
                currentMonth={currentMonth}
                events={filteredEvents}
                onSelectDate={handleSelectDate}
                onSelectEvent={handleSelectEvent}
              />
            ) : (
              <CalendarListView
                currentMonth={currentMonth}
                events={filteredEvents}
                hasActiveFilters={hasActiveFilters}
                onClearFilters={handleClearFilters}
                onSelectDate={handleSelectDate}
                onSelectEvent={handleSelectEvent}
              />
            )}
          </PrimaryCalendarArea>

          <CalendarCategoriesSidebar
            categories={categories}
            uncategorizedTags={uncategorizedTags}
            hiddenTags={hiddenTags}
            showUntagged={showUntagged}
            tagCounts={tagCounts}
            untaggedCount={untaggedCount}
            visibleMonthEventCount={monthEvents.length}
            isAdmin={isAdmin}
            onToggleTag={handleToggleTag}
            onToggleCategory={handleToggleCategory}
            onToggleUntagged={handleToggleUntagged}
            onSelectAll={handleSelectAllSidebar}
            onSelectNone={handleSelectNoneSidebar}
            onExportICal={handleExportICal}
            onOpenSubscriptionModal={handleOpenSubscriptionModal}
          />
        </MainContentRow>
      </CalendarWrapper>

      <CalendarEventModal
        isOpen={isEventModalOpen}
        event={editingEvent}
        initialDate={selectedDate}
        onRequestClose={handleCloseEventModal}
      />

      <CalendarEventDetailModal
        isOpen={isDetailModalOpen}
        event={selectedEvent}
        onEdit={handleEditEvent}
        onRequestClose={handleCloseDetailModal}
      />

      <CalendarSubscriptionModal
        isOpen={isSubscriptionModalOpen}
        visibleTags={visibleTags}
        includeUntagged={showUntagged}
        hasSidebarFilter={hasSidebarFilter}
        visibleEventCount={monthEvents.length}
        onExportICal={handleExportICal}
        onRequestClose={handleCloseSubscriptionModal}
      />
    </Scene>
  );
}

export default observer(Calendar);
