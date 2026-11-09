import * as React from "react";
import styled from "styled-components";
import { CollectionIcon, DocumentIcon, RestoreIcon } from "outline-icons";
import type CalendarEvent from "~/models/CalendarEvent";

interface Props {
  /** The calendar event to display */
  event: CalendarEvent;
  /** Callback when the badge is clicked */
  onClick: (event: CalendarEvent) => void;
}

const BadgeButton = styled.button<{ $color?: string | null }>`
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
  min-width: 0;
  padding: 3px 6px;
  border-radius: 5px;
  border: 1px solid
    ${({ $color, theme }) => ($color ? `${$color}30` : theme.divider)};
  border-left: 3px solid
    ${({ $color, theme }) => $color || theme.accent};
  background: ${({ $color, theme }) =>
    $color ? `${$color}16` : theme.backgroundSecondary};
  color: ${({ theme }) => theme.text};
  font-family: inherit;
  font-size: 12px;
  line-height: 1.35;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  white-space: nowrap;
  transition: background-color 120ms ease, border-color 120ms ease,
    transform 80ms ease;

  &:hover {
    background: ${({ $color, theme }) =>
      $color ? `${$color}28` : theme.buttonNeutralHoverBackground};
    border-color: ${({ $color, theme }) =>
      $color ? `${$color}66` : theme.accent};
    border-left-color: ${({ $color, theme }) => $color || theme.accent};
  }

  &:active {
    transform: scale(0.99);
  }
`;

const EventTitle = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
`;

const LinkedDocIcon = styled(DocumentIcon)`
  flex-shrink: 0;
  opacity: 0.65;
  color: ${({ theme }) => theme.textSecondary};
`;

const LinkedCollectionIcon = styled(CollectionIcon)`
  flex-shrink: 0;
  opacity: 0.65;
  color: ${({ theme }) => theme.textSecondary};
`;

const RepeatIcon = styled(RestoreIcon)`
  flex-shrink: 0;
  opacity: 0.65;
  color: ${({ theme }) => theme.textSecondary};
`;

const EventTime = styled.span`
  font-size: 11px;
  font-weight: 500;
  color: ${({ theme }) => theme.textSecondary};
  opacity: 0.85;
  flex-shrink: 0;
`;

/**
 * Renders an event badge within a calendar cell.
 *
 * @param props The component props.
 * @returns The rendered badge button.
 */
export function CalendarEventBadge({ event, onClick }: Props) {
  const handleClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick(event);
    },
    [event, onClick]
  );

  const formattedTime = React.useMemo(() => {
    if (event.allDay) {
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
  }, [event.allDay, event.startAt]);

  return (
    <BadgeButton
      type="button"
      $color={event.color}
      onClick={handleClick}
      title={
        formattedTime ? `${event.title} (${formattedTime})` : event.title
      }
    >
      <EventTitle>{event.title}</EventTitle>
      {event.recurrenceFrequency ? <RepeatIcon size={12} /> : null}
      {event.resolvedCollectionIds.length > 0 ? (
        <LinkedCollectionIcon size={12} />
      ) : null}
      {event.resolvedDocumentIds.length > 0 ? (
        <LinkedDocIcon size={12} />
      ) : null}
      {formattedTime ? <EventTime>{formattedTime}</EventTime> : null}
    </BadgeButton>
  );
}

export default React.memo(CalendarEventBadge);
