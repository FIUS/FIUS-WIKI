import * as React from "react";
import styled from "styled-components";
import { format } from "date-fns";
import { PlusIcon } from "outline-icons";
import { useTranslation } from "react-i18next";
import { breakpoint } from "@shared/styles/breakpoint";
import type CalendarEvent from "~/models/CalendarEvent";
import CalendarEventBadge from "./CalendarEventBadge";

interface Props {
  /** The date represented by this cell */
  date: Date;
  /** Whether this day belongs to the month currently displayed */
  isCurrentMonth: boolean;
  /** Whether this day is today */
  isToday: boolean;
  /** Whether this day falls on a weekend */
  isWeekend: boolean;
  /** The events occurring on this day */
  events: CalendarEvent[];
  /** Callback when the user clicks the cell or add button to create an event */
  onSelectDate: (date: Date) => void;
  /** Callback when the user clicks an event badge */
  onSelectEvent: (event: CalendarEvent) => void;
}

const Cell = styled.div<{
  $isCurrentMonth: boolean;
  $isToday: boolean;
  $isWeekend: boolean;
}>`
  min-height: 118px;
  padding: 8px;
  background: ${({ theme, $isCurrentMonth, $isToday, $isWeekend }) => {
    if ($isToday) {
      return `${theme.accent}0a`;
    }
    if (!$isCurrentMonth) {
      return theme.backgroundSecondary;
    }
    if ($isWeekend) {
      return `${theme.backgroundSecondary}66`;
    }
    return theme.background;
  }};
  border-right: 1px solid ${({ theme }) => theme.divider};
  border-bottom: 1px solid ${({ theme }) => theme.divider};
  display: flex;
  flex-direction: column;
  position: relative;
  cursor: pointer;
  transition: background-color 120ms ease;

  &:hover {
    background: ${({ theme, $isToday }) =>
      $isToday ? `${theme.accent}14` : theme.listItemHoverBackground};
  }

  &:hover .add-button {
    opacity: 1;
  }

  ${breakpoint("mobile", "tablet")`
    min-height: 90px;
    padding: 4px;
  `};
`;

const CellHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  min-height: 24px;
`;

const DayBadgeGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const DayNumber = styled.span<{ $isCurrentMonth: boolean; $isToday: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: ${({ $isToday }) => ($isToday ? "600" : "500")};
  color: ${({ theme, $isCurrentMonth, $isToday }) => {
    if ($isToday) {
      return theme.accentText;
    }
    return $isCurrentMonth ? theme.text : theme.textTertiary;
  }};
  background: ${({ theme, $isToday }) =>
    $isToday ? theme.accent : "transparent"};
  user-select: none;
`;

const TodayPill = styled.span`
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.accent};
  user-select: none;

  ${breakpoint("mobile", "tablet")`
    display: none;
  `};
`;

const AddEventButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 5px;
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.textTertiary};
  cursor: pointer;
  opacity: 0;
  transition:
    opacity 120ms ease,
    background-color 120ms ease,
    color 120ms ease;

  &:hover {
    color: ${({ theme }) => theme.text};
    background: ${({ theme }) => theme.divider};
  }
`;

const EventsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
`;

const MoreEventsButton = styled.button`
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  color: ${({ theme }) => theme.textSecondary};
  background: transparent;
  border: none;
  border-radius: 4px;
  padding: 2px 6px;
  margin-top: 1px;
  cursor: pointer;
  transition:
    background-color 100ms ease,
    color 100ms ease;

  &:hover {
    color: ${({ theme }) => theme.text};
    background: ${({ theme }) => theme.divider};
  }
`;

const MAX_DISPLAYED_EVENTS = 3;

/**
 * Renders an individual day cell in the calendar month view.
 *
 * @param props The day cell properties.
 * @returns The rendered day cell component.
 */
export function CalendarDayCell({
  date,
  isCurrentMonth,
  isToday,
  isWeekend,
  events,
  onSelectDate,
  onSelectEvent,
}: Props) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = React.useState(false);

  const handleCellClick = React.useCallback(() => {
    onSelectDate(date);
  }, [date, onSelectDate]);

  const handleAddClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelectDate(date);
    },
    [date, onSelectDate]
  );

  const handleToggleExpand = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded((prev) => !prev);
  }, []);

  const displayedEvents = isExpanded
    ? events
    : events.slice(0, MAX_DISPLAYED_EVENTS);
  const remainingCount = events.length - MAX_DISPLAYED_EVENTS;
  const isFirstDayOfMonth = date.getDate() === 1;

  return (
    <Cell
      $isCurrentMonth={isCurrentMonth}
      $isToday={isToday}
      $isWeekend={isWeekend}
      onClick={handleCellClick}
    >
      <CellHeader>
        <DayBadgeGroup>
          <DayNumber $isCurrentMonth={isCurrentMonth} $isToday={isToday}>
            {isFirstDayOfMonth && !isToday
              ? format(date, "MMM d")
              : format(date, "d")}
          </DayNumber>
          {isToday ? <TodayPill>{t("Today")}</TodayPill> : null}
        </DayBadgeGroup>
        <AddEventButton
          type="button"
          className="add-button"
          onClick={handleAddClick}
          aria-label={t("Add event")}
          title={t("Add event")}
        >
          <PlusIcon size={15} />
        </AddEventButton>
      </CellHeader>

      <EventsList>
        {displayedEvents.map((event) => (
          <CalendarEventBadge
            key={event.id}
            event={event}
            onClick={onSelectEvent}
          />
        ))}
        {remainingCount > 0 ? (
          <MoreEventsButton type="button" onClick={handleToggleExpand}>
            {isExpanded
              ? t("Show less")
              : t("+{{count}} more", { count: remainingCount })}
          </MoreEventsButton>
        ) : null}
      </EventsList>
    </Cell>
  );
}

export default React.memo(CalendarDayCell);
