import * as React from "react";
import {
  CheckmarkIcon,
  DownloadIcon,
  GlobeIcon,
  HashtagIcon,
  SettingsIcon,
} from "outline-icons";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import styled from "styled-components";
import type { CalendarCategory } from "@shared/types";
import Button from "~/components/Button";
import Flex from "~/components/Flex";
import Text from "~/components/Text";
import { settingsPath } from "~/utils/routeHelpers";

interface Props {
  /** Workspace calendar categories configured by admins */
  categories: CalendarCategory[];
  /** Custom tags present on events that are not part of any category */
  uncategorizedTags: string[];
  /** Set of lowercase tag names currently hidden by the user */
  hiddenTags: Set<string>;
  /** Whether events without any tags are shown */
  showUntagged: boolean;
  /** Event counts per lowercase tag */
  tagCounts: Map<string, number>;
  /** Count of events that have no tags */
  untaggedCount: number;
  /** Total visible events in current month */
  visibleMonthEventCount: number;
  /** Whether the current user is an admin and can edit workspace settings */
  isAdmin: boolean;
  /** Toggle a single tag's visibility */
  onToggleTag: (tag: string) => void;
  /** Toggle all tags in a category at once */
  onToggleCategory: (tags: string[]) => void;
  /** Toggle whether untagged events are shown */
  onToggleUntagged: () => void;
  /** Show all categories, tags, and untagged events */
  onSelectAll: () => void;
  /** Hide all categories, tags, and untagged events */
  onSelectNone: () => void;
  /** Export currently visible/selected events as .ics */
  onExportICal: () => void;
  /** Open CalDAV / Export modal with current selection */
  onOpenSubscriptionModal: () => void;
}

const SidebarCard = styled.aside`
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  background: ${({ theme }) => theme.background};
  border: 1px solid ${({ theme }) => theme.divider};
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  align-self: flex-start;

  @media (max-width: 1024px) {
    width: 100%;
  }
`;

const SidebarHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 10px;
  border-bottom: 1px solid ${({ theme }) => theme.divider};
`;

const QuickActionsRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const TextActionButton = styled.button`
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.accent};
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 4px;
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
`;

const SettingsLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  color: ${({ theme }) => theme.textSecondary};
  text-decoration: none;
  transition:
    background-color 120ms ease,
    color 120ms ease;

  &:hover {
    color: ${({ theme }) => theme.text};
    background: ${({ theme }) => theme.backgroundSecondary};
  }
`;

const CategoryGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-bottom: 12px;
  border-bottom: 1px solid ${({ theme }) => theme.divider};

  &:last-of-type {
    border-bottom: none;
    padding-bottom: 0;
  }
`;

const CategoryToggleRow = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 5px 6px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: ${({ theme }) => theme.text};
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  transition: background-color 120ms ease;

  &:hover {
    background: ${({ theme }) => theme.backgroundSecondary};
  }
`;

const CheckboxBox = styled.span<{
  $checked: boolean;
  $indeterminate?: boolean;
  $color: string;
}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1.5px solid
    ${({ $checked, $indeterminate, $color, theme }) =>
      $checked || $indeterminate ? $color : theme.inputBorder};
  background: ${({ $checked, $indeterminate, $color }) =>
    $checked ? $color : $indeterminate ? `${$color}30` : "transparent"};
  color: #ffffff;
  flex-shrink: 0;
  transition: all 120ms ease;
`;

const IndeterminateDash = styled.span<{ $color: string }>`
  width: 8px;
  height: 2px;
  border-radius: 1px;
  background: ${({ $color }) => $color};
`;

const CountBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: ${({ theme }) => theme.textTertiary};
  background: ${({ theme }) => theme.backgroundSecondary};
`;

const TagsGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding-left: 24px;
`;

const TagTogglePill = styled.button<{ $active: boolean; $color: string }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  font-family: inherit;
  font-size: 11px;
  font-weight: ${({ $active }) => ($active ? 600 : 500)};
  cursor: pointer;
  border: 1px solid
    ${({ $active, $color, theme }) => ($active ? `${$color}60` : theme.divider)};
  background: ${({ $active, $color, theme }) =>
    $active ? `${$color}18` : theme.backgroundSecondary};
  color: ${({ $active, $color, theme }) =>
    $active ? $color : theme.textTertiary};
  opacity: ${({ $active }) => ($active ? 1 : 0.65)};
  transition: all 120ms ease;

  &:hover {
    opacity: 1;
    border-color: ${({ $color }) => $color};
  }
`;

const TagCountText = styled.span`
  font-size: 10px;
  opacity: 0.8;
`;

const ExportSummaryBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: 8px;
  background: ${({ theme }) => theme.backgroundSecondary};
  border: 1px solid ${({ theme }) => theme.divider};
`;

/**
 * Right-hand sidebar in the Calendar view allowing users to show/hide events by category and tag,
 * and export only the selected categories/tags.
 *
 * @param props Component properties.
 * @returns The rendered sidebar component.
 */
export function CalendarCategoriesSidebar({
  categories,
  uncategorizedTags,
  hiddenTags,
  showUntagged,
  tagCounts,
  untaggedCount,
  visibleMonthEventCount,
  isAdmin,
  onToggleTag,
  onToggleCategory,
  onToggleUntagged,
  onSelectAll,
  onSelectNone,
  onExportICal,
  onOpenSubscriptionModal,
}: Props) {
  const { t } = useTranslation();

  const renderCategoryBlock = (
    id: string,
    name: string,
    color: string,
    tags: string[],
  ) => {
    const visibleCount = tags.filter(
      (tag) => !hiddenTags.has(tag.toLowerCase()),
    ).length;
    const allVisible = tags.length > 0 && visibleCount === tags.length;
    const someVisible = visibleCount > 0 && visibleCount < tags.length;

    const categoryEventCount = tags.reduce(
      (sum, tag) => sum + (tagCounts.get(tag.toLowerCase()) ?? 0),
      0,
    );

    return (
      <CategoryGroup key={id}>
        <CategoryToggleRow type="button" onClick={() => onToggleCategory(tags)}>
          <Flex align="center" gap={8} style={{ minWidth: 0 }}>
            <CheckboxBox
              $checked={allVisible}
              $indeterminate={someVisible}
              $color={color}
            >
              {allVisible ? (
                <CheckmarkIcon size={12} />
              ) : someVisible ? (
                <IndeterminateDash $color={color} />
              ) : null}
            </CheckboxBox>
            <Text size="small" weight="bold" ellipsis>
              {name}
            </Text>
          </Flex>
          <CountBadge>{categoryEventCount}</CountBadge>
        </CategoryToggleRow>

        {tags.length > 0 ? (
          <TagsGrid>
            {tags.map((tag) => {
              const lower = tag.toLowerCase();
              const isVisible = !hiddenTags.has(lower);
              const count = tagCounts.get(lower) ?? 0;

              return (
                <TagTogglePill
                  key={tag}
                  type="button"
                  $active={isVisible}
                  $color={color}
                  onClick={() => onToggleTag(tag)}
                  title={
                    isVisible
                      ? t("Click to hide #{{tag}} events", { tag })
                      : t("Click to show #{{tag}} events", { tag })
                  }
                >
                  <HashtagIcon size={11} />
                  {tag}
                  {count > 0 ? <TagCountText>({count})</TagCountText> : null}
                </TagTogglePill>
              );
            })}
          </TagsGrid>
        ) : null}
      </CategoryGroup>
    );
  };

  return (
    <SidebarCard>
      <SidebarHeader>
        <Text size="small" weight="bold">
          {t("Categories & Tags")}
        </Text>
        <Flex align="center" gap={4}>
          {isAdmin ? (
            <SettingsLink
              to={settingsPath("calendar")}
              title={t("Manage categories & calendar settings")}
            >
              <SettingsIcon size={16} />
            </SettingsLink>
          ) : null}
        </Flex>
      </SidebarHeader>

      {categories.map((cat) =>
        renderCategoryBlock(cat.id, cat.name, cat.color, cat.tags),
      )}

      {uncategorizedTags.length > 0
        ? renderCategoryBlock(
            "cat-uncategorized",
            t("Custom Tags"),
            "#64748B",
            uncategorizedTags,
          )
        : null}

      <CategoryGroup>
        <CategoryToggleRow type="button" onClick={onToggleUntagged}>
          <Flex align="center" gap={8}>
            <CheckboxBox $checked={showUntagged} $color="#64748B">
              {showUntagged ? <CheckmarkIcon size={12} /> : null}
            </CheckboxBox>
            <Text size="small" type="secondary" weight="bold">
              {t("Untagged events")}
            </Text>
          </Flex>
          <CountBadge>{untaggedCount}</CountBadge>
        </CategoryToggleRow>
      </CategoryGroup>

      <ExportSummaryBox>
        <Flex align="center" justify="space-between">
          <Text size="xsmall" weight="bold">
            {t("Visible for Export")}
          </Text>
          <CountBadge>{visibleMonthEventCount}</CountBadge>
        </Flex>
        <Flex gap={6} wrap style={{ marginTop: 2 }}>
          <Button
            type="button"
            neutral
            onClick={onExportICal}
            icon={<DownloadIcon />}
          >
            {t("Export .ics")}
          </Button>
          <Button
            type="button"
            neutral
            onClick={onOpenSubscriptionModal}
            icon={<GlobeIcon />}
          >
            {t("CalDAV")}
          </Button>
        </Flex>
      </ExportSummaryBox>
    </SidebarCard>
  );
}

export default React.memo(CalendarCategoriesSidebar);
