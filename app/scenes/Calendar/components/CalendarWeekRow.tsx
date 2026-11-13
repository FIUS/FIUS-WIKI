import * as React from "react";
import styled from "styled-components";
import {
  addDays,
  differenceInCalendarDays,
  format,
  isSameMonth,
  isToday,
  isWeekend,
  startOfDay,
  subDays,
} from "date-fns";
import { PlusIcon } from "outline-icons";
import { useTranslation } from "react-i18next";
import { breakpoint } from "@shared/styles/breakpoint";
import type CalendarEvent from "~/models/CalendarEvent";
import { doesEventOccurOnDay } from "../utils/recurrence";
import CalendarEventBadge from "./CalendarEventBadge";

export interface WeekEventSegment {
  event: CalendarEvent;
  startCol: number;
  endCol: number;
  colSpan: number;
  trackIndex: number;
  continuesFromPrevWeek: boolean;
  continuesToNextWeek: boolean;
  isMultiDay: boolean;
}

export interface CalendarWeekRowProps {
  /** The 7 dates representing the days in this week (Mon to Sun) */
  days: Date[];
  /** The month currently being viewed */
  currentMonth: Date;
  /** All calendar events passed from parent */
  events: CalendarEvent[];
  /** Callback when user clicks on a day to create an event */
  onSelectDate: (date: Date) => void;
  /** Callback when user clicks on an event badge */
  onSelectEvent: (event: CalendarEvent) => void;
}

const WeekRowContainer = styled.div`
  display: flex;
  flex-direction: column;
  position: relative;
  min-height: 120px;
  border-bottom: 1px solid ${({ theme }) => theme.divider};

  &:last-child {
    border-bottom: none;
  }

  ${breakpoint("mobile", "tablet")`
    min-height: 90px;
  `};
`;

const WeekBackgroundGrid = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  pointer-events: none;
`;

const DayBackgroundCell = styled.div<{
  $isCurrentMonth: boolean;
  $isToday: boolean;
  $isWeekend: boolean;
}>`
  border-right: 1px solid ${({ theme }) => theme.divider};
  pointer-events: auto;
  cursor: pointer;
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
  transition: background-color 120ms ease;

  &:last-child {
    border-right: none;
  }

  &:hover {
    background: ${({ theme, $isToday }) =>
      $isToday ? `${theme.accent}14` : theme.listItemHoverBackground};
  }
`;

const WeekHeaderGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  position: relative;
  z-index: 2;
  pointer-events: none;
`;

const DayHeaderCell = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px 3px 8px;
  min-height: 28px;
  pointer-events: auto;

  &:hover .add-button {
    opacity: 1;
  }

  ${breakpoint("mobile", "tablet")`
    padding: 4px 4px 2px 4px;
  `};
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

const WeekEventsGrid = styled.div<{ $trackCount: number }>`
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  grid-template-rows: repeat(
    ${({ $trackCount }) => Math.max($trackCount, 1)},
    23px
  );
  gap: 3px 0;
  padding: 1px 4px 6px 4px;
  position: relative;
  z-index: 2;
  pointer-events: none;
  flex: 1;
`;

const SegmentWrapper = styled.div<{
  $startCol: number;
  $colSpan: number;
  $trackIndex: number;
}>`
  grid-column: ${({ $startCol, $colSpan }) =>
    `${$startCol + 1} / span ${$colSpan}`};
  grid-row: ${({ $trackIndex }) => $trackIndex + 1};
  min-width: 0;
  display: flex;
  align-items: center;
  padding: 0 1px;
`;

/**
 * Computes the event segments and layout tracks for a single week row.
 *
 * @param days The 7 days of the week.
 * @param events All available calendar events.
 * @returns Allocated event segments positioned on the grid tracks.
 */
function computeWeekEventSegments(
  days: Date[],
  events: CalendarEvent[]
): WeekEventSegment[] {
  const weekStart = days[0];
  const weekEnd = days[6];
  const dayBeforeWeek = subDays(weekStart, 1);
  const dayAfterWeek = addDays(weekEnd, 1);

  const candidateSegments: Omit<WeekEventSegment, "trackIndex">[] = [];

  for (const event of events) {
    const eventStartDay = startOfDay(new Date(event.startAt));
    const eventEndDay = startOfDay(new Date(event.endAt));
    const eventDurationDays = differenceInCalendarDays(
      eventEndDay,
      eventStartDay
    );

    if (eventDurationDays > 0) {
      // Multi-day event: find continuous range of active days in this week
      const activeCols: number[] = [];
      for (let i = 0; i < 7; i++) {
        if (doesEventOccurOnDay(event, days[i])) {
          activeCols.push(i);
        }
      }

      if (activeCols.length > 0) {
        const startCol = activeCols[0];
        const endCol = activeCols[activeCols.length - 1];
        const colSpan = endCol - startCol + 1;
        const continuesFromPrevWeek = doesEventOccurOnDay(event, dayBeforeWeek);
        const continuesToNextWeek = doesEventOccurOnDay(event, dayAfterWeek);

        candidateSegments.push({
          event,
          startCol,
          endCol,
          colSpan,
          continuesFromPrevWeek,
          continuesToNextWeek,
          isMultiDay: true,
        });
      }
    } else {
      // Single-day event: place on each day it occurs
      for (let i = 0; i < 7; i++) {
        if (doesEventOccurOnDay(event, days[i])) {
          candidateSegments.push({
            event,
            startCol: i,
            endCol: i,
            colSpan: 1,
            continuesFromPrevWeek: false,
            continuesToNextWeek: false,
            isMultiDay: false,
          });
        }
      }
    }
  }

  // Sort candidate segments:
  // 1. Multi-day continuous bars always first (on top)
  // 2. Longer spans first
  // 3. Earlier starting columns first
  // 4. Earlier start time first
  candidateSegments.sort((a, b) => {
    if (a.isMultiDay !== b.isMultiDay) {
      return a.isMultiDay ? -1 : 1;
    }
    if (b.colSpan !== a.colSpan) {
      return b.colSpan - a.colSpan;
    }
    if (a.startCol !== b.startCol) {
      return a.startCol - b.startCol;
    }
    const aTime = new Date(a.event.startAt).getTime();
    const bTime = new Date(b.event.startAt).getTime();
    if (aTime !== bTime) {
      return aTime - bTime;
    }
    return a.event.title.localeCompare(b.event.title);
  });

  // Track allocation (slot packing)
  const tracks: boolean[][] = [];
  const allocatedSegments: WeekEventSegment[] = [];

  for (const candidate of candidateSegments) {
    let trackIndex = 0;
    while (true) {
      if (!tracks[trackIndex]) {
        tracks[trackIndex] = [false, false, false, false, false, false, false];
      }

      let isFree = true;
      for (let c = candidate.startCol; c <= candidate.endCol; c++) {
        if (tracks[trackIndex][c]) {
          isFree = false;
          break;
        }
      }

      if (isFree) {
        for (let c = candidate.startCol; c <= candidate.endCol; c++) {
          tracks[trackIndex][c] = true;
        }
        allocatedSegments.push({
          ...candidate,
          trackIndex,
        });
        break;
      }

      trackIndex++;
    }
  }

  return allocatedSegments;
}

/**
 * Renders a single week row in the calendar month view with continuous multi-day event bars.
 *
 * @param props Component properties.
 * @returns The rendered week row component.
 */
export function CalendarWeekRow({
  days,
  currentMonth,
  events,
  onSelectDate,
  onSelectEvent,
}: CalendarWeekRowProps) {
  const { t } = useTranslation();

  const segments = React.useMemo(
    () => computeWeekEventSegments(days, events),
    [days, events]
  );

  const trackCount = React.useMemo(() => {
    let max = 0;
    for (const seg of segments) {
      if (seg.trackIndex + 1 > max) {
        max = seg.trackIndex + 1;
      }
    }
    return max;
  }, [segments]);

  return (
    <WeekRowContainer>
      <WeekBackgroundGrid>
        {days.map((day) => {
          const isCurr = isSameMonth(day, currentMonth);
          const isTod = isToday(day);
          const isWknd = isWeekend(day);

          return (
            <DayBackgroundCell
              key={day.toISOString()}
              $isCurrentMonth={isCurr}
              $isToday={isTod}
              $isWeekend={isWknd}
              onClick={() => onSelectDate(day)}
            />
          );
        })}
      </WeekBackgroundGrid>

      <WeekHeaderGrid>
        {days.map((day) => {
          const isCurr = isSameMonth(day, currentMonth);
          const isTod = isToday(day);
          const isFirstDayOfMonth = day.getDate() === 1;

          return (
            <DayHeaderCell key={day.toISOString()}>
              <DayBadgeGroup>
                <DayNumber $isCurrentMonth={isCurr} $isToday={isTod}>
                  {isFirstDayOfMonth && !isTod
                    ? format(day, "MMM d")
                    : format(day, "d")}
                </DayNumber>
                {isTod ? <TodayPill>{t("Today")}</TodayPill> : null}
              </DayBadgeGroup>
              <AddEventButton
                type="button"
                className="add-button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectDate(day);
                }}
                aria-label={t("Add event")}
                title={t("Add event")}
              >
                <PlusIcon size={14} />
              </AddEventButton>
            </DayHeaderCell>
          );
        })}
      </WeekHeaderGrid>

      <WeekEventsGrid $trackCount={trackCount}>
        {segments.map((seg) => (
          <SegmentWrapper
            key={`${seg.event.id}-${seg.startCol}-${seg.colSpan}`}
            $startCol={seg.startCol}
            $colSpan={seg.colSpan}
            $trackIndex={seg.trackIndex}
          >
            <CalendarEventBadge
              event={seg.event}
              isMultiDay={seg.isMultiDay}
              continuesFromPrevWeek={seg.continuesFromPrevWeek}
              continuesToNextWeek={seg.continuesToNextWeek}
              onClick={onSelectEvent}
            />
          </SegmentWrapper>
        ))}
      </WeekEventsGrid>
    </WeekRowContainer>
  );
}

export default React.memo(CalendarWeekRow);
