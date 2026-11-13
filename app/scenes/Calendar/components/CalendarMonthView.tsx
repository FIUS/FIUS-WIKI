import * as React from "react";
import styled from "styled-components";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
} from "date-fns";
import { useTranslation } from "react-i18next";
import type CalendarEvent from "~/models/CalendarEvent";
import CalendarWeekRow from "./CalendarWeekRow";

export interface Props {
  /** The currently selected month date */
  currentMonth: Date;
  /** List of events to display */
  events: CalendarEvent[];
  /** Callback when a date is selected to create an event */
  onSelectDate: (date: Date) => void;
  /** Callback when an event badge is selected to view details */
  onSelectEvent: (event: CalendarEvent) => void;
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  background: ${({ theme }) => theme.background};
  border: 1px solid ${({ theme }) => theme.divider};
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
`;

const WeekdaysRow = styled.div`
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  background: ${({ theme }) => theme.backgroundSecondary};
  border-bottom: 1px solid ${({ theme }) => theme.divider};
`;

const WeekdayHeader = styled.div<{ $isWeekend?: boolean }>`
  padding: 10px 12px;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${({ theme, $isWeekend }) =>
    $isWeekend ? theme.textTertiary : theme.textSecondary};
  border-right: 1px solid ${({ theme }) => theme.divider};
  user-select: none;

  &:last-child {
    border-right: none;
  }
`;

const WeeksContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

/**
 * Renders the full month grid with weekday headers and continuous multi-day event bars.
 *
 * @param props Component properties.
 * @returns The rendered month view component.
 */
export function CalendarMonthView({
  currentMonth,
  events,
  onSelectDate,
  onSelectEvent,
}: Props) {
  const { t } = useTranslation();

  const weekdayLabels = React.useMemo(
    () => [
      { label: t("Mon"), isWeekend: false },
      { label: t("Tue"), isWeekend: false },
      { label: t("Wed"), isWeekend: false },
      { label: t("Thu"), isWeekend: false },
      { label: t("Fri"), isWeekend: false },
      { label: t("Sat"), isWeekend: true },
      { label: t("Sun"), isWeekend: true },
    ],
    [t]
  );

  const monthStart = React.useMemo(
    () => startOfMonth(currentMonth),
    [currentMonth]
  );
  const monthEnd = React.useMemo(() => endOfMonth(monthStart), [monthStart]);
  const startDate = React.useMemo(
    () => startOfWeek(monthStart, { weekStartsOn: 1 }),
    [monthStart]
  );
  const endDate = React.useMemo(
    () => endOfWeek(monthEnd, { weekStartsOn: 1 }),
    [monthEnd]
  );

  const days = React.useMemo(
    () => eachDayOfInterval({ start: startDate, end: endDate }),
    [startDate, endDate]
  );

  const weeks = React.useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [days]);

  return (
    <Container>
      <WeekdaysRow>
        {weekdayLabels.map((item) => (
          <WeekdayHeader key={item.label} $isWeekend={item.isWeekend}>
            {item.label}
          </WeekdayHeader>
        ))}
      </WeekdaysRow>

      <WeeksContainer>
        {weeks.map((weekDays) => (
          <CalendarWeekRow
            key={weekDays[0].toISOString()}
            days={weekDays}
            currentMonth={monthStart}
            events={events}
            onSelectDate={onSelectDate}
            onSelectEvent={onSelectEvent}
          />
        ))}
      </WeeksContainer>
    </Container>
  );
}

export default React.memo(CalendarMonthView);
