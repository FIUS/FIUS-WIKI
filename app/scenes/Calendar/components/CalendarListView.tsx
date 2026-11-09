import { observer } from "mobx-react";
import * as React from "react";
import { endOfMonth, format, isToday, startOfMonth } from "date-fns";
import {
  CalendarIcon,
  CollectionIcon,
  DocumentIcon,
  HashtagIcon,
  PlusIcon,
  RestoreIcon,
  UserIcon,
} from "outline-icons";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import Button from "~/components/Button";
import Flex from "~/components/Flex";
import Text from "~/components/Text";
import useStores from "~/hooks/useStores";
import type CalendarEvent from "~/models/CalendarEvent";
import { formatRecurrenceLabel, getDayScheduleGroups } from "../utils/recurrence";

interface Props {
  /** The currently selected month date */
  currentMonth: Date;
  /** Filtered list of events to display */
  events: CalendarEvent[];
  /** Whether active search or filters are applied */
  hasActiveFilters: boolean;
  /** Callback to clear active filters */
  onClearFilters: () => void;
  /** Callback when a date is selected to create an event */
  onSelectDate: (date: Date) => void;
  /** Callback when an event is clicked to view details */
  onSelectEvent: (event: CalendarEvent) => void;
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
`;

const DaySection = styled.div`
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.background};
  border: 1px solid ${({ theme }) => theme.divider};
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
`;

const DayHeader = styled.div<{ $isToday: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: ${({ theme, $isToday }) =>
    $isToday ? `${theme.accent}12` : theme.backgroundSecondary};
  border-bottom: 1px solid ${({ theme }) => theme.divider};
`;

const DayTitleGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const TodayBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.accentText};
  background: ${({ theme }) => theme.accent};
`;

const QuickAddButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 5px;
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.textSecondary};
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;

  &:hover {
    color: ${({ theme }) => theme.text};
    background: ${({ theme }) => theme.divider};
  }
`;

const EventRows = styled.div`
  display: flex;
  flex-direction: column;
`;

const EventRowButton = styled.button<{ $color?: string | null }>`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  padding: 14px 16px;
  border: none;
  border-bottom: 1px solid ${({ theme }) => theme.divider};
  border-left: 4px solid ${({ $color, theme }) => $color || theme.accent};
  background: transparent;
  color: ${({ theme }) => theme.text};
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 120ms ease;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${({ theme }) => theme.listItemHoverBackground};
  }
`;

const TimeColumn = styled.div`
  min-width: 120px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 1px;
`;

const AllDayPill = styled.span<{ $color?: string | null }>`
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: ${({ $color, theme }) => $color || theme.accent};
  background: ${({ $color, theme }) =>
    $color ? `${$color}18` : `${theme.accent}18`};
`;

const ContentColumn = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const EventTitleText = styled.span`
  font-size: 15px;
  font-weight: 600;
  line-height: 1.3;
  color: ${({ theme }) => theme.text};
`;

const DescriptionPreview = styled.p`
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: ${({ theme }) => theme.textSecondary};
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const MetaBadgesRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 2px;
`;

const MetaChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  color: ${({ theme }) => theme.textSecondary};
  background: ${({ theme }) => theme.backgroundSecondary};
  border: 1px solid ${({ theme }) => theme.divider};
`;

const TagMetaChip = styled(MetaChip)`
  color: ${({ theme }) => theme.accent};
  background: ${({ theme }) => `${theme.accent}16`};
  border-color: ${({ theme }) => `${theme.accent}35`};
  font-weight: 600;
`;

const EmptyStateCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 56px 24px;
  text-align: center;
  background: ${({ theme }) => theme.background};
  border: 1px solid ${({ theme }) => theme.divider};
  border-radius: 12px;
`;

const EmptyIconCircle = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: ${({ theme }) => theme.backgroundSecondary};
  color: ${({ theme }) => theme.textSecondary};
`;

/**
 * Renders a chronological agenda/list view of calendar events for the selected month.
 *
 * @param props Component properties.
 * @returns The rendered list view component.
 */
function CalendarListView({
  currentMonth,
  events,
  hasActiveFilters,
  onClearFilters,
  onSelectDate,
  onSelectEvent,
}: Props) {
  const { t } = useTranslation();
  const { collections, documents, users } = useStores();

  const dayGroups = React.useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return getDayScheduleGroups(events, start, end);
  }, [currentMonth, events]);

  const formatEventTimeRange = (event: CalendarEvent) => {
    try {
      const start = new Date(event.startAt);
      const end = new Date(event.endAt);
      return `${format(start, "HH:mm")} – ${format(end, "HH:mm")}`;
    } catch {
      return "";
    }
  };

  if (dayGroups.length === 0) {
    return (
      <EmptyStateCard>
        <EmptyIconCircle>
          <CalendarIcon size={22} />
        </EmptyIconCircle>
        <Flex column align="center" gap={4}>
          <Text size="medium" weight="bold">
            {hasActiveFilters
              ? t("No events match your current search or filters")
              : t("No events scheduled in {{month}}", {
                  month: format(currentMonth, "MMMM yyyy"),
                })}
          </Text>
          <Text size="small" type="secondary">
            {hasActiveFilters
              ? t("Try adjusting your search query or resetting the filters.")
              : t("Create a new event to schedule meetings, deadlines, or milestones.")}
          </Text>
        </Flex>
        <Flex gap={8} style={{ marginTop: 4 }}>
          {hasActiveFilters ? (
            <Button type="button" neutral onClick={onClearFilters}>
              {t("Reset filters")}
            </Button>
          ) : null}
          <Button
            type="button"
            icon={<PlusIcon />}
            onClick={() => onSelectDate(new Date())}
          >
            {t("New event")}
          </Button>
        </Flex>
      </EmptyStateCard>
    );
  }

  return (
    <Container>
      {dayGroups.map(({ date, events: dayEvents }) => {
        const todayFlag = isToday(date);

        return (
          <DaySection key={date.toISOString()}>
            <DayHeader $isToday={todayFlag}>
              <DayTitleGroup>
                {todayFlag ? <TodayBadge>{t("Today")}</TodayBadge> : null}
                <Text size="small" weight="bold">
                  {format(date, "EEEE, MMMM d, yyyy")}
                </Text>
              </DayTitleGroup>

              <QuickAddButton
                type="button"
                onClick={() => onSelectDate(date)}
              >
                <PlusIcon size={14} />
                {t("Add event")}
              </QuickAddButton>
            </DayHeader>

            <EventRows>
              {dayEvents.map((event) => {
                const recurrenceText = formatRecurrenceLabel(event, t);
                const linkedCols = event.resolvedCollectionIds
                  .map((id) => collections.get(id))
                  .filter((c): c is NonNullable<typeof c> => Boolean(c));
                const linkedDocs = event.resolvedDocumentIds
                  .map((id) => documents.get(id))
                  .filter((d): d is NonNullable<typeof d> => Boolean(d));
                const assignedUsers = (event.assigneeIds ?? [])
                  .map((id) => users.get(id))
                  .filter((u): u is NonNullable<typeof u> => Boolean(u));
                const eventTags = event.tags ?? [];

                return (
                  <EventRowButton
                    key={`${date.toISOString()}-${event.id}`}
                    type="button"
                    $color={event.color}
                    onClick={() => onSelectEvent(event)}
                  >
                    <TimeColumn>
                      {event.allDay ? (
                        <AllDayPill $color={event.color}>
                          {t("All day")}
                        </AllDayPill>
                      ) : (
                        <Text size="small" weight="bold" type="secondary">
                          {formatEventTimeRange(event)}
                        </Text>
                      )}
                    </TimeColumn>

                    <ContentColumn>
                      <EventTitleText>{event.title}</EventTitleText>
                      {event.description ? (
                        <DescriptionPreview>
                          {event.description}
                        </DescriptionPreview>
                      ) : null}

                      {recurrenceText ||
                      eventTags.length > 0 ||
                      assignedUsers.length > 0 ||
                      linkedCols.length > 0 ||
                      linkedDocs.length > 0 ||
                      event.createdBy ? (
                        <MetaBadgesRow>
                          {eventTags.map((tag) => (
                            <TagMetaChip key={`tag-${tag}`}>
                              <HashtagIcon size={12} />
                              {tag}
                            </TagMetaChip>
                          ))}

                          {assignedUsers.map((user) => (
                            <MetaChip key={`assignee-${user.id}`}>
                              <UserIcon size={13} />
                              {user.name}
                            </MetaChip>
                          ))}

                          {recurrenceText ? (
                            <MetaChip>
                              <RestoreIcon size={13} />
                              {recurrenceText}
                            </MetaChip>
                          ) : null}

                          {linkedCols.map((col) => (
                            <MetaChip key={`col-${col.id}`}>
                              <CollectionIcon size={13} />
                              {col.displayName}
                            </MetaChip>
                          ))}

                          {linkedDocs.map((doc) => (
                            <MetaChip key={`doc-${doc.id}`}>
                              <DocumentIcon size={13} />
                              {doc.displayTitle}
                            </MetaChip>
                          ))}

                          {event.createdBy && assignedUsers.length === 0 ? (
                            <MetaChip>
                              <UserIcon size={13} />
                              {event.createdBy.name}
                            </MetaChip>
                          ) : null}
                        </MetaBadgesRow>
                      ) : null}
                    </ContentColumn>
                  </EventRowButton>
                );
              })}
            </EventRows>
          </DaySection>
        );
      })}
    </Container>
  );
}

export default observer(CalendarListView);
