import { observer } from "mobx-react";
import * as React from "react";
import {
  CalendarIcon,
  CheckmarkIcon,
  CloseIcon,
  HashtagIcon,
  PadlockIcon,
  PlusIcon,
  RestoreIcon,
  TeamIcon,
  TrashIcon,
} from "outline-icons";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import styled from "styled-components";
import {
  CalendarEventPermissionType,
  DEFAULT_CALENDAR_CATEGORIES,
  DEFAULT_CALENDAR_SETTINGS,
  type CalendarCategory,
  type CalendarWorkspaceSettings,
} from "@shared/types";
import Button from "~/components/Button";
import Flex from "~/components/Flex";
import Heading from "~/components/Heading";
import Input from "~/components/Input";
import { InputSelect, type Option } from "~/components/InputSelect";
import Scene from "~/components/Scene";
import Switch from "~/components/Switch";
import Text from "~/components/Text";
import useStores from "~/hooks/useStores";
import { ActionRow } from "./components/ActionRow";
import SettingRow from "./components/SettingRow";

const PRESET_COLORS = [
  "#0366d6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#64748B",
];

const SwatchRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const SwatchButton = styled.button<{ $color: string; $selected: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
  border: 2px solid
    ${({ $selected, theme }) => ($selected ? theme.background : "transparent")};
  box-shadow: ${({ $selected, $color }) =>
    $selected ? `0 0 0 2px ${$color}` : "0 1px 2px rgba(0, 0, 0, 0.15)"};
  color: #ffffff;
  cursor: pointer;
  padding: 0;
  transition: transform 100ms ease;

  &:hover {
    transform: scale(1.1);
  }
`;

const CategoriesSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid ${({ theme }) => theme.divider};
`;

const CategoryCard = styled.div<{ $color: string }>`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 10px;
  background: ${({ theme }) => theme.backgroundSecondary};
  border: 1px solid ${({ theme }) => theme.divider};
  border-left: 4px solid ${({ $color }) => $color};
`;

const CategoryHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
`;

const CategoryNameInput = styled.input`
  height: 32px;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid ${({ theme }) => theme.inputBorder};
  background: ${({ theme }) => theme.background};
  color: ${({ theme }) => theme.text};
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  min-width: 220px;
  outline: none;

  &:focus {
    border-color: ${({ theme }) => theme.inputBorderFocused};
  }
`;

const TagsContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
`;

const TagBadge = styled.span<{ $color: string }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: ${({ $color }) => $color};
  background: ${({ $color }) => `${$color}18`};
  border: 1px solid ${({ $color }) => `${$color}40`};
`;

const RemoveTagBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 0;

  &:hover {
    opacity: 0.7;
  }
`;

const AddTagRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 360px;
`;

const NewCategoryBox = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px dashed ${({ theme }) => theme.divider};
  background: ${({ theme }) => theme.background};
`;

/**
 * Workspace Admin Settings scene for managing Calendar defaults, policies, categories, and tags.
 *
 * @returns The rendered CalendarSettings scene component.
 */
function CalendarSettings() {
  const { t } = useTranslation();
  const { calendarEvents } = useStores();

  const [formState, setFormState] = React.useState<CalendarWorkspaceSettings>(
    () => ({
      ...DEFAULT_CALENDAR_SETTINGS,
      ...calendarEvents.settings,
      categories: calendarEvents.settings.categories.map((cat) => ({
        ...cat,
        tags: [...cat.tags],
      })),
    })
  );
  const [tagDrafts, setTagDrafts] = React.useState<Record<string, string>>({});
  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [newCategoryColor, setNewCategoryColor] = React.useState(
    PRESET_COLORS[0]
  );
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    void calendarEvents.fetchSettings().then((loaded) => {
      setFormState({
        ...DEFAULT_CALENDAR_SETTINGS,
        ...loaded,
        categories: loaded.categories.map((cat) => ({
          ...cat,
          tags: [...cat.tags],
        })),
      });
    });
  }, [calendarEvents]);

  const viewModeOptions: Option[] = React.useMemo(
    () => [
      {
        type: "item",
        value: "month",
        label: t("Month Grid"),
      },
      {
        type: "item",
        value: "list",
        label: t("Agenda List"),
      },
    ],
    [t]
  );

  const permissionOptions: Option[] = React.useMemo(
    () => [
      {
        type: "item",
        value: CalendarEventPermissionType.CreatorOrAdmin,
        label: t("Creator & Admins"),
        description: t("Only the event creator and workspace admins can edit"),
        icon: <PadlockIcon />,
      },
      {
        type: "item",
        value: CalendarEventPermissionType.All,
        label: t("Everyone in Workspace"),
        description: t("All workspace members can edit events by default"),
        icon: <TeamIcon />,
      },
    ],
    [t]
  );

  const handleUpdateCategory = React.useCallback(
    (catId: string, patch: Partial<CalendarCategory>) => {
      setFormState((prev) => ({
        ...prev,
        categories: prev.categories.map((cat) =>
          cat.id === catId ? { ...cat, ...patch } : cat
        ),
      }));
    },
    []
  );

  const handleDeleteCategory = React.useCallback((catId: string) => {
    setFormState((prev) => ({
      ...prev,
      categories: prev.categories.filter((cat) => cat.id !== catId),
    }));
  }, []);

  const handleAddTagToCategory = React.useCallback(
    (catId: string) => {
      const raw = (tagDrafts[catId] ?? "").trim().replace(/^#+/, "");
      if (!raw) {
        return;
      }

      setFormState((prev) => ({
        ...prev,
        categories: prev.categories.map((cat) => {
          if (cat.id !== catId) {
            return cat;
          }
          const exists = cat.tags.some(
            (existing) => existing.toLowerCase() === raw.toLowerCase()
          );
          return exists ? cat : { ...cat, tags: [...cat.tags, raw] };
        }),
      }));

      setTagDrafts((prev) => ({ ...prev, [catId]: "" }));
    },
    [tagDrafts]
  );

  const handleRemoveTagFromCategory = React.useCallback(
    (catId: string, tagToRemove: string) => {
      setFormState((prev) => ({
        ...prev,
        categories: prev.categories.map((cat) =>
          cat.id === catId
            ? { ...cat, tags: cat.tags.filter((tItem) => tItem !== tagToRemove) }
            : cat
        ),
      }));
    },
    []
  );

  const handleAddCategory = React.useCallback(() => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      toast.error(t("Please enter a category name."));
      return;
    }

    const newCat: CalendarCategory = {
      id: `cat-${Date.now()}`,
      name: trimmed,
      color: newCategoryColor,
      tags: [],
    };

    setFormState((prev) => ({
      ...prev,
      categories: [...prev.categories, newCat],
    }));
    setNewCategoryName("");
  }, [newCategoryName, newCategoryColor, t]);

  const handleResetCategories = React.useCallback(() => {
    setFormState((prev) => ({
      ...prev,
      categories: DEFAULT_CALENDAR_CATEGORIES.map((cat) => ({
        ...cat,
        tags: [...cat.tags],
      })),
    }));
    toast.info(t("Default categories restored. Click Save to apply."));
  }, [t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await calendarEvents.updateSettings(formState);
      toast.success(t("Calendar settings saved."));
    } catch {
      toast.error(t("Could not save calendar settings."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Scene title={t("Calendar")} icon={<CalendarIcon />}>
      <Heading>{t("Calendar")}</Heading>
      <Text as="p" type="secondary">
        {t(
          "Configure workspace-wide defaults, permissions, CalDAV feed access, and event categories & tags for your team calendar."
        )}
      </Text>

      <form onSubmit={handleSubmit}>
        <SettingRow
          label={t("Default view mode")}
          name="defaultViewMode"
          description={t(
            "Choose whether the workspace calendar opens in Month Grid or Agenda List view by default."
          )}
        >
          <InputSelect
            label={t("Default view mode")}
            labelHidden
            value={formState.defaultViewMode}
            options={viewModeOptions}
            onChange={(val) =>
              setFormState((prev) => ({
                ...prev,
                defaultViewMode: val as "month" | "list",
              }))
            }
          />
        </SettingRow>

        <SettingRow
          label={t("Default event edit permission")}
          name="defaultPermissionType"
          description={t(
            "Select who is allowed to edit newly created calendar events by default."
          )}
        >
          <InputSelect
            label={t("Default event edit permission")}
            labelHidden
            value={formState.defaultPermissionType}
            options={permissionOptions}
            onChange={(val) =>
              setFormState((prev) => ({
                ...prev,
                defaultPermissionType: val as CalendarEventPermissionType,
              }))
            }
          />
        </SettingRow>

        <SettingRow
          label={t("Default event color")}
          name="defaultColor"
          description={t(
            "Default highlight color preselected when creating a new event."
          )}
        >
          <SwatchRow>
            {PRESET_COLORS.map((color) => {
              const isSelected =
                formState.defaultColor.toLowerCase() === color.toLowerCase();
              return (
                <SwatchButton
                  key={color}
                  type="button"
                  $color={color}
                  $selected={isSelected}
                  onClick={() =>
                    setFormState((prev) => ({ ...prev, defaultColor: color }))
                  }
                  aria-label={color}
                >
                  {isSelected ? <CheckmarkIcon size={13} /> : null}
                </SwatchButton>
              );
            })}
          </SwatchRow>
        </SettingRow>

        <SettingRow
          label={t("Allow custom tags")}
          name="allowCustomTags"
          description={t(
            "Allow workspace members to create custom tags on events in addition to the predefined category tags below."
          )}
        >
          <Switch
            id="allowCustomTags"
            name="allowCustomTags"
            checked={formState.allowCustomTags}
            onChange={(checked) =>
              setFormState((prev) => ({ ...prev, allowCustomTags: checked }))
            }
          />
        </SettingRow>

        <SettingRow
          label={t("Enable CalDAV / iCal feeds")}
          name="enableCaldavFeeds"
          description={t(
            "Allow members to subscribe to live external CalDAV / iCal feed URLs in Apple Calendar, Google Calendar, or Outlook."
          )}
          border={false}
        >
          <Switch
            id="enableCaldavFeeds"
            name="enableCaldavFeeds"
            checked={formState.enableCaldavFeeds}
            onChange={(checked) =>
              setFormState((prev) => ({ ...prev, enableCaldavFeeds: checked }))
            }
          />
        </SettingRow>

        <CategoriesSection>
          <Flex align="center" justify="space-between" gap={12} wrap>
            <Flex column gap={4}>
              <Heading as="h2" style={{ margin: 0, fontSize: 18 }}>
                {t("Categories & Tags")}
              </Heading>
              <Text size="small" type="secondary">
                {t(
                  "Organize tags into categories. Members can filter the calendar, toggle visibility in the right sidebar, and customize their iCal/CalDAV exports by category and tag."
                )}
              </Text>
            </Flex>
            <Button
              type="button"
              neutral
              onClick={handleResetCategories}
              icon={<RestoreIcon />}
            >
              {t("Restore defaults")}
            </Button>
          </Flex>

          {formState.categories.map((cat) => (
            <CategoryCard key={cat.id} $color={cat.color}>
              <CategoryHeader>
                <Flex align="center" gap={12} wrap>
                  <CategoryNameInput
                    type="text"
                    value={cat.name}
                    onChange={(e) =>
                      handleUpdateCategory(cat.id, { name: e.target.value })
                    }
                    placeholder={t("Category name")}
                  />

                  <SwatchRow>
                    {PRESET_COLORS.map((color) => {
                      const isSelected =
                        cat.color.toLowerCase() === color.toLowerCase();
                      return (
                        <SwatchButton
                          key={color}
                          type="button"
                          $color={color}
                          $selected={isSelected}
                          onClick={() =>
                            handleUpdateCategory(cat.id, { color })
                          }
                          aria-label={color}
                        >
                          {isSelected ? <CheckmarkIcon size={12} /> : null}
                        </SwatchButton>
                      );
                    })}
                  </SwatchRow>
                </Flex>

                <Button
                  type="button"
                  neutral
                  danger
                  onClick={() => handleDeleteCategory(cat.id)}
                  icon={<TrashIcon />}
                >
                  {t("Remove")}
                </Button>
              </CategoryHeader>

              <TagsContainer>
                {cat.tags.length === 0 ? (
                  <Text size="xsmall" type="tertiary">
                    {t("No tags in this category yet.")}
                  </Text>
                ) : (
                  cat.tags.map((tag) => (
                    <TagBadge key={tag} $color={cat.color}>
                      <HashtagIcon size={12} />
                      {tag}
                      <RemoveTagBtn
                        type="button"
                        onClick={() => handleRemoveTagFromCategory(cat.id, tag)}
                        aria-label={t("Remove tag")}
                      >
                        <CloseIcon size={12} />
                      </RemoveTagBtn>
                    </TagBadge>
                  ))
                )}
              </TagsContainer>

              <AddTagRow>
                <div style={{ flex: 1 }}>
                  <Input
                    placeholder={t("Add tag to {{category}}...", {
                      category: cat.name,
                    })}
                    value={tagDrafts[cat.id] ?? ""}
                    onChange={(e) =>
                      setTagDrafts((prev) => ({
                        ...prev,
                        [cat.id]: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        handleAddTagToCategory(cat.id);
                      }
                    }}
                    margin={0}
                  />
                </div>
                <Button
                  type="button"
                  neutral
                  onClick={() => handleAddTagToCategory(cat.id)}
                  disabled={!(tagDrafts[cat.id] ?? "").trim()}
                  icon={<PlusIcon />}
                >
                  {t("Add tag")}
                </Button>
              </AddTagRow>
            </CategoryCard>
          ))}

          <NewCategoryBox>
            <Flex align="center" gap={12} wrap style={{ flex: 1 }}>
              <CategoryNameInput
                type="text"
                placeholder={t("New category name (e.g. Marketing, HR)...")}
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCategory();
                  }
                }}
              />
              <SwatchRow>
                {PRESET_COLORS.map((color) => {
                  const isSelected =
                    newCategoryColor.toLowerCase() === color.toLowerCase();
                  return (
                    <SwatchButton
                      key={color}
                      type="button"
                      $color={color}
                      $selected={isSelected}
                      onClick={() => setNewCategoryColor(color)}
                      aria-label={color}
                    >
                      {isSelected ? <CheckmarkIcon size={12} /> : null}
                    </SwatchButton>
                  );
                })}
              </SwatchRow>
            </Flex>
            <Button
              type="button"
              neutral
              onClick={handleAddCategory}
              icon={<PlusIcon />}
            >
              {t("Add category")}
            </Button>
          </NewCategoryBox>
        </CategoriesSection>

        <ActionRow style={{ marginTop: 24 }}>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? t("Saving…") : t("Save")}
          </Button>
        </ActionRow>
      </form>
    </Scene>
  );
}

export default observer(CalendarSettings);
