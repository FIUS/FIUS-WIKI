import * as React from "react";
import styled from "styled-components";
import { CollectionIcon, DocumentIcon, RestoreIcon } from "outline-icons";
import type CalendarEvent from "~/models/CalendarEvent";

export interface Props {
  /** The calendar event to display */
  event: CalendarEvent;
  /** Whether the event spans multiple days */
  isMultiDay?: boolean;
  /** Whether the event bar continues from the previous week */
  continuesFromPrevWeek?: boolean;
  /** Whether the event bar continues into the next week */
  continuesToNextWeek?: boolean;
  /** Callback when the badge is clicked */
  onClick: (event: CalendarEvent) => void;
}

const BadgeButton = styled.button<{
  $color?: string | null;
  $isMultiDay: boolean;
  $continuesLeft: boolean;
  $continuesRight: boolean;
}>`
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
  min-width: 0;
  height: 23px;
  padding: 0 7px;
  font-family: inherit;
  font-size: 12px;
  line-height: 1.35;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  white-space: nowrap;
  pointer-events: auto;
  user-select: none;
  transition:
    filter 120ms ease,
    background-color 120ms ease,
    border-color 120ms ease,
    transform 80ms ease;

  ${({ $isMultiDay, $color, $continuesLeft, $continuesRight, theme }) =>
    $isMultiDay
      ? `
    background: ${$color || theme.accent};
    color: #ffffff;
    border: none;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
    border-top-left-radius: ${$continuesLeft ? "0" : "5px"};
    border-bottom-left-radius: ${$continuesLeft ? "0" : "5px"};
    border-top-right-radius: ${$continuesRight ? "0" : "5px"};
    border-bottom-right-radius: ${$continuesRight ? "0" : "5px"};

    &:hover {
      filter: brightness(1.1);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.18);
    }
  `
      : `
    border-radius: 5px;
    border: 1px solid ${$color ? `${$color}30` : theme.divider};
    border-left: 3px solid ${$color || theme.accent};
    background: ${$color ? `${$color}16` : theme.backgroundSecondary};
    color: ${theme.text};

    &:hover {
      background: ${$color ? `${$color}28` : theme.buttonNeutralHoverBackground};
      border-color: ${$color ? `${$color}66` : theme.accent};
      border-left-color: ${$color || theme.accent};
    }
  `}

  &:active {
    transform: scale(0.99);
  }
`;

const ContinuationIndicator = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  line-height: 1;
  opacity: 0.9;
  flex-shrink: 0;
  font-weight: 700;
`;

const EventTitle = styled.span<{ $isMultiDay?: boolean }>`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: ${({ $isMultiDay }) => ($isMultiDay ? "600" : "500")};
`;

const LinkedDocIcon = styled(DocumentIcon)<{ $isMultiDay?: boolean }>`
  flex-shrink: 0;
  opacity: ${({ $isMultiDay }) => ($isMultiDay ? "0.9" : "0.65")};
  color: ${({ $isMultiDay, theme }) =>
    $isMultiDay ? "#ffffff" : theme.textSecondary};
`;

const LinkedCollectionIcon = styled(CollectionIcon)<{ $isMultiDay?: boolean }>`
  flex-shrink: 0;
  opacity: ${({ $isMultiDay }) => ($isMultiDay ? "0.9" : "0.65")};
  color: ${({ $isMultiDay, theme }) =>
    $isMultiDay ? "#ffffff" : theme.textSecondary};
`;

const RepeatIcon = styled(RestoreIcon)<{ $isMultiDay?: boolean }>`
  flex-shrink: 0;
  opacity: ${({ $isMultiDay }) => ($isMultiDay ? "0.9" : "0.65")};
  color: ${({ $isMultiDay, theme }) =>
    $isMultiDay ? "#ffffff" : theme.textSecondary};
`;

const EventTime = styled.span`
  font-size: 11px;
  font-weight: 500;
  color: ${({ theme }) => theme.textSecondary};
  opacity: 0.85;
  flex-shrink: 0;
`;

/**
 * Renders an event badge within a calendar cell or spanning multi-day bar.
 *
 * @param props The component props.
 * @returns The rendered badge button.
 */
export function CalendarEventBadge({
  event,
  isMultiDay = false,
  continuesFromPrevWeek = false,
  continuesToNextWeek = false,
  onClick,
}: Props) {
  const handleClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick(event);
    },
    [event, onClick]
  );

  const formattedTime = React.useMemo(() => {
    if (event.allDay || isMultiDay) {
      return null;
    }

    try {
      const date = new Date(event.startAt);
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return null;
    }
  }, [event.allDay, event.startAt, isMultiDay]);

  return (
    <BadgeButton
      type="button"
      $color={event.color}
      $isMultiDay={isMultiDay}
      $continuesLeft={continuesFromPrevWeek}
      $continuesRight={continuesToNextWeek}
      onClick={handleClick}
      title={formattedTime ? `${event.title} (${formattedTime})` : event.title}
    >
      {continuesFromPrevWeek ? (
        <ContinuationIndicator aria-hidden="true">‹</ContinuationIndicator>
      ) : null}
      <EventTitle $isMultiDay={isMultiDay}>{event.title}</EventTitle>
      {event.recurrenceFrequency ? (
        <RepeatIcon size={12} $isMultiDay={isMultiDay} />
      ) : null}
      {event.resolvedCollectionIds.length > 0 ? (
        <LinkedCollectionIcon size={12} $isMultiDay={isMultiDay} />
      ) : null}
      {event.resolvedDocumentIds.length > 0 ? (
        <LinkedDocIcon size={12} $isMultiDay={isMultiDay} />
      ) : null}
      {formattedTime ? <EventTime>{formattedTime}</EventTime> : null}
      {continuesToNextWeek ? (
        <ContinuationIndicator aria-hidden="true">›</ContinuationIndicator>
      ) : null}
    </BadgeButton>
  );
}

export default React.memo(CalendarEventBadge);
