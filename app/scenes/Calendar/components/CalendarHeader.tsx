import * as React from "react";
import styled from "styled-components";
import { format, isSameMonth } from "date-fns";
import {
  BackIcon,
  BulletedListIcon,
  CalendarIcon,
  CloseIcon,
  NextIcon,
  PlusIcon,
  SearchIcon,
} from "outline-icons";
import { useTranslation } from "react-i18next";
import Button from "~/components/Button";
import Flex from "~/components/Flex";
import Heading from "~/components/Heading";

export type CalendarViewMode = "month" | "list";
export type CalendarFilterMode =
  "all" | "mine" | "assigned" | "recurring" | "references" | "allDay";

interface Props {
  /** The currently selected month date */
  currentMonth: Date;
  /** Number of events in the current month */
  eventCount: number;
  /** Active view mode (month grid or agenda list) */
  viewMode: CalendarViewMode;
  /** Change the view mode */
  onViewModeChange: (mode: CalendarViewMode) => void;
  /** Current search query */
  searchQuery: string;
  /** Update search query */
  onSearchChange: (query: string) => void;
  /** Active quick filter */
  filterMode: CalendarFilterMode;
  /** Update quick filter */
  onFilterModeChange: (mode: CalendarFilterMode) => void;
  /** Whether any filter or sidebar tag filter is active */
  hasActiveFilters: boolean;
  /** Reset all filters and search */
  onClearFilters: () => void;
  /** Navigate to previous month */
  onPrevMonth: () => void;
  /** Navigate to next month */
  onNextMonth: () => void;
  /** Reset to current date */
  onToday: () => void;
  /** Trigger creation of a new event */
  onNewEvent: () => void;
}

const HeaderContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const TopBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
`;

const FilterToolbar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  background: ${({ theme }) => theme.backgroundSecondary};
  border: 1px solid ${({ theme }) => theme.divider};
`;

const FilterTopRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
`;

const SearchInputWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  min-width: 240px;
  flex: 1;
  max-width: 340px;
`;

const SearchIconStyled = styled(SearchIcon)`
  position: absolute;
  left: 10px;
  color: ${({ theme }) => theme.textTertiary};
  pointer-events: none;
`;

const SearchInput = styled.input`
  width: 100%;
  height: 32px;
  padding: 0 28px 0 32px;
  border-radius: 6px;
  border: 1px solid ${({ theme }) => theme.inputBorder};
  background: ${({ theme }) => theme.background};
  color: ${({ theme }) => theme.text};
  font-family: inherit;
  font-size: 13px;
  outline: none;
  transition: border-color 120ms ease;

  &::placeholder {
    color: ${({ theme }) => theme.placeholder};
  }

  &:focus {
    border-color: ${({ theme }) => theme.inputBorderFocused};
  }
`;

const ClearSearchButton = styled.button`
  position: absolute;
  right: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.textTertiary};
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.text};
    background: ${({ theme }) => theme.divider};
  }
`;

const FilterPillsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
`;

const FilterPill = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid
    ${({ theme, $active }) => ($active ? theme.accent : theme.divider)};
  background: ${({ theme, $active }) =>
    $active ? `${theme.accent}18` : theme.background};
  color: ${({ theme, $active }) =>
    $active ? theme.accent : theme.textSecondary};
  font-family: inherit;
  font-size: 12px;
  font-weight: ${({ $active }) => ($active ? 600 : 500)};
  cursor: pointer;
  transition: all 120ms ease;

  &:hover {
    border-color: ${({ theme }) => theme.accent};
    color: ${({ theme, $active }) => ($active ? theme.accent : theme.text)};
  }
`;

const ResetButton = styled.button`
  height: 28px;
  padding: 0 8px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.textSecondary};
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.text};
    text-decoration: underline;
  }
`;

const MonthHeading = styled(Heading)`
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.2;
`;

const EventCountBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  color: ${({ theme }) => theme.textSecondary};
  background: ${({ theme }) => theme.backgroundSecondary};
  border: 1px solid ${({ theme }) => theme.divider};
`;

const SegmentedGroup = styled.div`
  display: inline-flex;
  align-items: center;
  border-radius: 6px;
  border: 1px solid ${({ theme }) => theme.buttonNeutralBorder};
  background: ${({ theme }) => theme.buttonNeutralBackground};
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
`;

const SegmentButton = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 32px;
  padding: 0 12px;
  border: none;
  border-right: 1px solid ${({ theme }) => theme.divider};
  background: ${({ theme, $active }) =>
    $active ? theme.backgroundSecondary : "transparent"};
  color: ${({ theme, $active }) =>
    $active ? theme.text : theme.textSecondary};
  font-size: 13px;
  font-weight: ${({ $active }) => ($active ? 600 : 500)};
  font-family: inherit;
  cursor: pointer;
  transition:
    background-color 120ms ease,
    color 120ms ease;

  &:last-child {
    border-right: none;
  }

  &:hover {
    color: ${({ theme }) => theme.text};
    background: ${({ theme }) => theme.buttonNeutralHoverBackground};
  }
`;

const IconSegmentButton = styled(SegmentButton)`
  padding: 0 8px;
  min-width: 32px;
`;

/**
 * Header bar for the calendar scene displaying month title, navigation, view mode toggle,
 * search and filter controls, and new event trigger.
 *
 * @param props The header component properties.
 * @returns The rendered header component.
 */
export function CalendarHeader({
  currentMonth,
  eventCount,
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchChange,
  filterMode,
  onFilterModeChange,
  hasActiveFilters,
  onClearFilters,
  onPrevMonth,
  onNextMonth,
  onToday,
  onNewEvent,
}: Props) {
  const { t } = useTranslation();
  const [today] = React.useState<Date>(() => new Date());
  const isCurrentMonth = isSameMonth(currentMonth, today);

  return (
    <HeaderContainer>
      <TopBar>
        <Flex align="center" gap={12} wrap>
          <MonthHeading>{format(currentMonth, "MMMM yyyy")}</MonthHeading>
          <EventCountBadge>
            {eventCount === 1
              ? t("1 event")
              : t("{{count}} events", { count: eventCount })}
          </EventCountBadge>
        </Flex>

        <Flex align="center" gap={10} wrap>
          <SegmentedGroup>
            <SegmentButton
              type="button"
              $active={viewMode === "month"}
              onClick={() => onViewModeChange("month")}
            >
              <CalendarIcon size={15} />
              {t("Month")}
            </SegmentButton>
            <SegmentButton
              type="button"
              $active={viewMode === "list"}
              onClick={() => onViewModeChange("list")}
            >
              <BulletedListIcon size={15} />
              {t("List")}
            </SegmentButton>
          </SegmentedGroup>

          <SegmentedGroup>
            <IconSegmentButton
              type="button"
              onClick={onPrevMonth}
              aria-label={t("Previous month")}
              title={t("Previous month")}
            >
              <BackIcon size={16} />
            </IconSegmentButton>
            <SegmentButton
              type="button"
              $active={isCurrentMonth}
              onClick={onToday}
            >
              {t("Today")}
            </SegmentButton>
            <IconSegmentButton
              type="button"
              onClick={onNextMonth}
              aria-label={t("Next month")}
              title={t("Next month")}
            >
              <NextIcon size={16} />
            </IconSegmentButton>
          </SegmentedGroup>

          <Button type="button" onClick={onNewEvent} icon={<PlusIcon />}>
            {t("New event")}
          </Button>
        </Flex>
      </TopBar>

      <FilterToolbar>
        <FilterTopRow>
          <SearchInputWrapper>
            <SearchIconStyled size={16} />
            <SearchInput
              type="text"
              placeholder={t(
                "Search events, tags, assignees, or references...",
              )}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            {searchQuery ? (
              <ClearSearchButton
                type="button"
                onClick={() => onSearchChange("")}
                aria-label={t("Clear search")}
              >
                <CloseIcon size={14} />
              </ClearSearchButton>
            ) : null}
          </SearchInputWrapper>

          <FilterPillsRow>
            <FilterPill
              type="button"
              $active={filterMode === "all"}
              onClick={() => onFilterModeChange("all")}
            >
              {t("All")}
            </FilterPill>
            <FilterPill
              type="button"
              $active={filterMode === "assigned"}
              onClick={() => onFilterModeChange("assigned")}
            >
              {t("Assigned to me")}
            </FilterPill>
            <FilterPill
              type="button"
              $active={filterMode === "mine"}
              onClick={() => onFilterModeChange("mine")}
            >
              {t("My events")}
            </FilterPill>

            <ResetButton type="button" onClick={onClearFilters}>
              {t("Reset")}
            </ResetButton>
          </FilterPillsRow>
        </FilterTopRow>
      </FilterToolbar>
    </HeaderContainer>
  );
}

export default React.memo(CalendarHeader);
