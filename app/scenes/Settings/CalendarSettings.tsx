import { observer } from "mobx-react";
import * as React from "react";
import {
  CalendarIcon,
  CheckmarkIcon,
  CloseIcon,
  GlobeIcon,
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
  DEFAULT_CALENDAR_SETTINGS,
  type CaldavConnection,
  type CaldavSyncDirection,
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

const SectionBlock = styled.div`
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

const InlineTextInput = styled.input`
  height: 32px;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid ${({ theme }) => theme.inputBorder};
  background: ${({ theme }) => theme.background};
  color: ${({ theme }) => theme.text};
  font-family: inherit;
  font-size: 13px;
  font-weight: 500;
  min-width: 200px;
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

const SelectableTagPill = styled.button<{ $active: boolean; $color: string }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: 999px;
  font-family: inherit;
  font-size: 11px;
  font-weight: ${({ $active }) => ($active ? 600 : 500)};
  cursor: pointer;
  border: 1px solid
    ${({ $active, $color, theme }) => ($active ? $color : theme.divider)};
  background: ${({ $active, $color, theme }) =>
    $active ? `${$color}18` : theme.background};
  color: ${({ $active, $color, theme }) =>
    $active ? $color : theme.textSecondary};
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

const DashedBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 10px;
  border: 1px dashed ${({ theme }) => theme.divider};
  background: ${({ theme }) => theme.background};
`;

const GridTwoCols = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

/**
 * Workspace Admin Settings scene for managing Calendar defaults, policies, categories, tags,
 * and bidirectional CalDAV connections.
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
      caldavConnections: (calendarEvents.settings.caldavConnections ?? []).map(
        (conn) => ({
          ...conn,
          defaultTags: [...conn.defaultTags],
        }),
      ),
    }),
  );
  const [tagDrafts, setTagDrafts] = React.useState<Record<string, string>>({});
  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [newCategoryColor, setNewCategoryColor] = React.useState(
    PRESET_COLORS[0],
  );

  // New CalDAV Connection draft state
  const [newConnName, setNewConnName] = React.useState("");
  const [newConnUrl, setNewConnUrl] = React.useState("");
  const [newConnUsername, setNewConnUsername] = React.useState("");
  const [newConnPassword, setNewConnPassword] = React.useState("");
  const [newConnDirection, setNewConnDirection] =
    React.useState<CaldavSyncDirection>("bidirectional");
  const [newConnColor, setNewConnColor] = React.useState(PRESET_COLORS[0]);
  const [newConnTags, setNewConnTags] = React.useState<string[]>([]);

  const [isSaving, setIsSaving] = React.useState(false);
  const [syncingId, setSyncingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    void calendarEvents.fetchSettings().then((loaded) => {
      setFormState({
        ...DEFAULT_CALENDAR_SETTINGS,
        ...loaded,
        categories: loaded.categories.map((cat) => ({
          ...cat,
          tags: [...cat.tags],
        })),
        caldavConnections: (loaded.caldavConnections ?? []).map((conn) => ({
          ...conn,
          defaultTags: [...conn.defaultTags],
        })),
      });
    });
  }, [calendarEvents]);

  const allCategoryTags = React.useMemo(() => {
    const tags: string[] = [];
    for (const cat of formState.categories) {
      for (const tag of cat.tags) {
        if (!tags.some((tItem) => tItem.toLowerCase() === tag.toLowerCase())) {
          tags.push(tag);
        }
      }
    }
    return tags;
  }, [formState.categories]);

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
    [t],
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
    [t],
  );

  const syncDirectionOptions: Option[] = React.useMemo(
    () => [
      {
        type: "item",
        value: "bidirectional",
        label: t("Two-Way CalDAV Sync (Import & Push)"),
        description: t(
          "Imports remote CalDAV events and pushes matching Outline events back",
        ),
      },
      {
        type: "item",
        value: "import_only",
        label: t("One-Way Import & Keep in Sync"),
        description: t(
          "Pulls events from the external CalDAV / .ics calendar into Outline",
        ),
      },
    ],
    [t],
  );

  const handleUpdateCategory = React.useCallback(
    (catId: string, patch: Partial<CalendarCategory>) => {
      setFormState((prev) => ({
        ...prev,
        categories: prev.categories.map((cat) =>
          cat.id === catId ? { ...cat, ...patch } : cat,
        ),
      }));
    },
    [],
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
            (existing) => existing.toLowerCase() === raw.toLowerCase(),
          );
          return exists ? cat : { ...cat, tags: [...cat.tags, raw] };
        }),
      }));

      setTagDrafts((prev) => ({ ...prev, [catId]: "" }));
    },
    [tagDrafts],
  );

  const handleRemoveTagFromCategory = React.useCallback(
    (catId: string, tagToRemove: string) => {
      setFormState((prev) => ({
        ...prev,
        categories: prev.categories.map((cat) =>
          cat.id === catId
            ? {
                ...cat,
                tags: cat.tags.filter((tItem) => tItem !== tagToRemove),
              }
            : cat,
        ),
      }));
    },
    [],
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

  const handleAddCaldavConnection = React.useCallback(() => {
    const name = newConnName.trim();
    const url = newConnUrl.trim();
    if (!name || !url) {
      toast.error(
        t("Please enter both a connection name and a CalDAV/.ics URL."),
      );
      return;
    }

    const newConn: CaldavConnection = {
      id: `caldav-${Date.now()}`,
      name,
      url,
      username: newConnUsername.trim() || null,
      password: newConnPassword || null,
      defaultColor: newConnColor,
      defaultTags: [...newConnTags],
      syncDirection: newConnDirection,
      enabled: true,
      lastSyncedAt: null,
      lastSyncStatus: null,
      syncedEventIds: [],
    };

    setFormState((prev) => ({
      ...prev,
      caldavConnections: [...(prev.caldavConnections ?? []), newConn],
    }));
    setNewConnName("");
    setNewConnUrl("");
    setNewConnUsername("");
    setNewConnPassword("");
    setNewConnTags([]);
    toast.success(
      t("CalDAV connection added. Click Save Settings or Sync Now."),
    );
  }, [
    newConnName,
    newConnUrl,
    newConnUsername,
    newConnPassword,
    newConnColor,
    newConnTags,
    newConnDirection,
    t,
  ]);

  const handleUpdateConnection = React.useCallback(
    (connId: string, patch: Partial<CaldavConnection>) => {
      setFormState((prev) => ({
        ...prev,
        caldavConnections: (prev.caldavConnections ?? []).map((conn) =>
          conn.id === connId ? { ...conn, ...patch } : conn,
        ),
      }));
    },
    [],
  );

  const handleToggleConnectionTag = React.useCallback(
    (connId: string, tag: string) => {
      setFormState((prev) => ({
        ...prev,
        caldavConnections: (prev.caldavConnections ?? []).map((conn) => {
          if (conn.id !== connId) {
            return conn;
          }
          const exists = conn.defaultTags.some(
            (tItem) => tItem.toLowerCase() === tag.toLowerCase(),
          );
          return {
            ...conn,
            defaultTags: exists
              ? conn.defaultTags.filter(
                  (tItem) => tItem.toLowerCase() !== tag.toLowerCase(),
                )
              : [...conn.defaultTags, tag],
          };
        }),
      }));
    },
    [],
  );

  const handleDeleteConnection = React.useCallback((connId: string) => {
    setFormState((prev) => ({
      ...prev,
      caldavConnections: (prev.caldavConnections ?? []).filter(
        (conn) => conn.id !== connId,
      ),
    }));
  }, []);

  const handleSyncConnectionNow = async (connId: string) => {
    setSyncingId(connId);
    try {
      await calendarEvents.updateSettings(formState);
      const stats = await calendarEvents.syncCaldav(connId);
      setFormState((prev) => ({
        ...prev,
        caldavConnections: (
          calendarEvents.settings.caldavConnections ?? []
        ).map((c) => ({ ...c, defaultTags: [...c.defaultTags] })),
      }));
      toast.success(
        t(
          "CalDAV synced: {{imported}} imported, {{updated}} updated, {{pushed}} pushed.",
          {
            imported: stats.imported,
            updated: stats.updated,
            pushed: stats.pushed ?? 0,
          },
        ),
      );
    } catch {
      toast.error(
        t(
          "Could not sync with remote CalDAV server. Please check the URL and credentials.",
        ),
      );
    } finally {
      setSyncingId(null);
    }
  };

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
          "Configure workspace-wide defaults, permissions, bidirectional CalDAV synchronization, and event categories & tags for your team calendar.",
        )}
      </Text>

      <form onSubmit={handleSubmit}>
        <SettingRow
          label={t("Default view mode")}
          name="defaultViewMode"
          description={t(
            "Choose whether the workspace calendar opens in Month Grid or Agenda List view by default.",
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
            "Select who is allowed to edit newly created calendar events by default.",
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
            "Default highlight color preselected when creating a new event.",
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
            "Allow workspace members to create custom tags on events in addition to the predefined category tags below.",
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
            "Allow members to subscribe to live external CalDAV / iCal feed URLs in Apple Calendar, Google Calendar, or Outlook.",
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

        <SectionBlock>
          <Flex align="center" justify="space-between" gap={12} wrap>
            <Flex column gap={4}>
              <Heading as="h2" style={{ margin: 0, fontSize: 18 }}>
                {t("CalDAV Sync & External Calendars")}
              </Heading>
              <Text size="small" type="secondary">
                {t(
                  "Connect external CalDAV servers (Nextcloud, Apple iCloud, Fastmail, Radicale) or .ics feeds, map their events to Outline tags and colors, and keep both sides in sync.",
                )}
              </Text>
            </Flex>
          </Flex>

          {(formState.caldavConnections ?? []).map((conn) => (
            <CategoryCard key={conn.id} $color={conn.defaultColor}>
              <CategoryHeader>
                <Flex align="center" gap={10} wrap>
                  <GlobeIcon size={18} />
                  <InlineTextInput
                    type="text"
                    value={conn.name}
                    onChange={(e) =>
                      handleUpdateConnection(conn.id, { name: e.target.value })
                    }
                    placeholder={t("Calendar name")}
                  />
                  <Switch
                    label={t("Enabled")}
                    checked={conn.enabled}
                    onChange={(checked) =>
                      handleUpdateConnection(conn.id, { enabled: checked })
                    }
                    height={18}
                    width={34}
                  />
                </Flex>

                <Flex align="center" gap={8}>
                  <Button
                    type="button"
                    neutral
                    disabled={syncingId === conn.id}
                    onClick={() => handleSyncConnectionNow(conn.id)}
                    icon={<RestoreIcon />}
                  >
                    {syncingId === conn.id ? t("Syncing…") : t("Sync Now")}
                  </Button>
                  <Button
                    type="button"
                    neutral
                    danger
                    onClick={() => handleDeleteConnection(conn.id)}
                    icon={<TrashIcon />}
                  >
                    {t("Remove")}
                  </Button>
                </Flex>
              </CategoryHeader>

              <GridTwoCols>
                <Input
                  label={t("CalDAV Collection or .ics URL")}
                  value={conn.url}
                  onChange={(e) =>
                    handleUpdateConnection(conn.id, { url: e.target.value })
                  }
                  margin={0}
                />
                <InputSelect
                  label={t("Sync Mode")}
                  value={conn.syncDirection}
                  options={syncDirectionOptions}
                  onChange={(val) =>
                    handleUpdateConnection(conn.id, {
                      syncDirection: val as CaldavSyncDirection,
                    })
                  }
                />
              </GridTwoCols>

              <Flex column gap={6}>
                <Text size="xsmall" type="secondary" weight="bold">
                  {t(
                    "Mapped Tags (applied on import & used to filter two-way push)",
                  )}
                </Text>
                <TagsContainer>
                  {allCategoryTags.map((tag) => {
                    const isSelected = conn.defaultTags.some(
                      (tItem) => tItem.toLowerCase() === tag.toLowerCase(),
                    );
                    return (
                      <SelectableTagPill
                        key={tag}
                        type="button"
                        $active={isSelected}
                        $color={conn.defaultColor}
                        onClick={() => handleToggleConnectionTag(conn.id, tag)}
                      >
                        <HashtagIcon size={11} />
                        {tag}
                      </SelectableTagPill>
                    );
                  })}
                </TagsContainer>
              </Flex>

              {conn.lastSyncedAt ? (
                <Text size="xsmall" type="tertiary">
                  {t("Last synced: {{date}} ({{status}})", {
                    date: new Date(conn.lastSyncedAt).toLocaleString(),
                    status: conn.lastSyncStatus ?? "ok",
                  })}
                </Text>
              ) : null}
            </CategoryCard>
          ))}

          <DashedBox>
            <Text size="small" weight="bold">
              {t("Add External CalDAV / iCal Connection")}
            </Text>

            <GridTwoCols>
              <Input
                label={t("Connection Name")}
                placeholder={t(
                  "e.g. Nextcloud Team Calendar, Google Calendar...",
                )}
                value={newConnName}
                onChange={(e) => setNewConnName(e.target.value)}
                margin={0}
              />
              <Input
                label={t("CalDAV or .ics URL")}
                placeholder={t(
                  "https://caldav.example.com/calendars/team/ or webcal://...",
                )}
                value={newConnUrl}
                onChange={(e) => setNewConnUrl(e.target.value)}
                margin={0}
              />
            </GridTwoCols>

            <GridTwoCols>
              <Input
                label={t("Username (optional, for CalDAV Basic Auth)")}
                placeholder={t("Username or email")}
                value={newConnUsername}
                onChange={(e) => setNewConnUsername(e.target.value)}
                margin={0}
              />
              <Input
                type="password"
                label={t("App Password / Token (optional)")}
                placeholder={t("Password or app-specific token")}
                value={newConnPassword}
                onChange={(e) => setNewConnPassword(e.target.value)}
                margin={0}
              />
            </GridTwoCols>

            <GridTwoCols>
              <InputSelect
                label={t("Sync Direction")}
                value={newConnDirection}
                options={syncDirectionOptions}
                onChange={(val) =>
                  setNewConnDirection(val as CaldavSyncDirection)
                }
              />

              <Flex column gap={6}>
                <Text size="small" weight="bold">
                  {t("Mapped Event Color")}
                </Text>
                <SwatchRow>
                  {PRESET_COLORS.map((color) => {
                    const isSelected =
                      newConnColor.toLowerCase() === color.toLowerCase();
                    return (
                      <SwatchButton
                        key={color}
                        type="button"
                        $color={color}
                        $selected={isSelected}
                        onClick={() => setNewConnColor(color)}
                        aria-label={color}
                      >
                        {isSelected ? <CheckmarkIcon size={12} /> : null}
                      </SwatchButton>
                    );
                  })}
                </SwatchRow>
              </Flex>
            </GridTwoCols>

            <Flex column gap={6}>
              <Text size="small" weight="bold">
                {t("Map to Tags / Categories")}
              </Text>
              <TagsContainer>
                {allCategoryTags.map((tag) => {
                  const isSelected = newConnTags.some(
                    (tItem) => tItem.toLowerCase() === tag.toLowerCase(),
                  );
                  return (
                    <SelectableTagPill
                      key={tag}
                      type="button"
                      $active={isSelected}
                      $color={newConnColor}
                      onClick={() =>
                        setNewConnTags((prev) =>
                          isSelected
                            ? prev.filter(
                                (tItem) =>
                                  tItem.toLowerCase() !== tag.toLowerCase(),
                              )
                            : [...prev, tag],
                        )
                      }
                    >
                      <HashtagIcon size={11} />
                      {tag}
                    </SelectableTagPill>
                  );
                })}
              </TagsContainer>
            </Flex>

            <Flex justify="flex-end">
              <Button
                type="button"
                neutral
                onClick={handleAddCaldavConnection}
                icon={<PlusIcon />}
              >
                {t("Add CalDAV Connection")}
              </Button>
            </Flex>
          </DashedBox>
        </SectionBlock>

        <SectionBlock>
          <Flex align="center" justify="space-between" gap={12} wrap>
            <Flex column gap={4}>
              <Heading as="h2" style={{ margin: 0, fontSize: 18 }}>
                {t("Categories & Tags")}
              </Heading>
              <Text size="small" type="secondary">
                {t(
                  "Organize tags into categories. Members can filter the calendar, toggle visibility in the right sidebar, and customize their iCal/CalDAV exports by category and tag.",
                )}
              </Text>
            </Flex>
          </Flex>

          {formState.categories.map((cat) => (
            <CategoryCard key={cat.id} $color={cat.color}>
              <CategoryHeader>
                <Flex align="center" gap={12} wrap>
                  <InlineTextInput
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

          <DashedBox>
            <Flex align="center" justify="space-between" gap={12} wrap>
              <Flex align="center" gap={12} wrap style={{ flex: 1 }}>
                <InlineTextInput
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
            </Flex>
          </DashedBox>
        </SectionBlock>

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
