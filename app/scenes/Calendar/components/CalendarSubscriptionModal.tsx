import { observer } from "mobx-react";
import * as React from "react";
import {
  CheckmarkIcon,
  CopyIcon,
  DownloadIcon,
  GlobeIcon,
  HashtagIcon,
  ImportIcon,
  OpenIcon,
  RestoreIcon,
  SettingsIcon,
} from "outline-icons";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import styled from "styled-components";
import Button from "~/components/Button";
import Flex from "~/components/Flex";
import Input from "~/components/Input";
import { InputSelect, type Option } from "~/components/InputSelect";
import Modal from "~/components/Modal";
import Switch from "~/components/Switch";
import Text from "~/components/Text";
import useStores from "~/hooks/useStores";
import { client } from "~/utils/ApiClient";
import { settingsPath } from "~/utils/routeHelpers";

interface Props {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Visible tags currently selected in the right-hand sidebar */
  visibleTags: string[];
  /** Whether untagged events are currently enabled in the sidebar */
  includeUntagged: boolean;
  /** Whether the user has deselected any tags or untagged events in the sidebar */
  hasSidebarFilter: boolean;
  /** Number of visible events in the current month matching the selection */
  visibleEventCount: number;
  /** Callback to download the current view as a static .ics file */
  onExportICal: () => void;
  /** Callback to close the modal */
  onRequestClose: () => void;
}

type ModalTab = "feed" | "sync" | "import";

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

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  padding: 4px 0 0;
`;

const TabsBar = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  padding: 4px;
  border-radius: 8px;
  background: ${({ theme }) => theme.backgroundSecondary};
  border: 1px solid ${({ theme }) => theme.divider};
`;

const TabButton = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 30px;
  border: none;
  border-radius: 6px;
  background: ${({ theme, $active }) =>
    $active ? theme.background : "transparent"};
  color: ${({ theme, $active }) =>
    $active ? theme.text : theme.textSecondary};
  font-family: inherit;
  font-size: 12px;
  font-weight: ${({ $active }) => ($active ? 600 : 500)};
  cursor: pointer;
  box-shadow: ${({ $active }) =>
    $active ? "0 1px 2px rgba(0, 0, 0, 0.06)" : "none"};
  transition: all 120ms ease;

  &:hover {
    color: ${({ theme }) => theme.text};
  }
`;

const InfoBox = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 8px;
  background: ${({ theme }) => theme.backgroundSecondary};
  border: 1px solid ${({ theme }) => theme.divider};

  svg {
    flex-shrink: 0;
    margin-top: 1px;
    color: ${({ theme }) => theme.accent};
  }
`;

const SelectionCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  background: ${({ theme }) => theme.backgroundSecondary};
  border: 1px solid ${({ theme }) => theme.divider};
`;

const ConnectionRow = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  background: ${({ theme }) => theme.backgroundSecondary};
  border: 1px solid ${({ theme }) => theme.divider};
  border-left: 4px solid ${({ $color }) => $color};
`;

const TagsPreviewRow = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
`;

const TagPill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: ${({ theme }) => theme.accent};
  background: ${({ theme }) => `${theme.accent}18`};
`;

const SelectableTagButton = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 9px;
  border-radius: 999px;
  font-family: inherit;
  font-size: 11px;
  font-weight: ${({ $active }) => ($active ? 600 : 500)};
  cursor: pointer;
  border: 1px solid
    ${({ theme, $active }) => ($active ? theme.accent : theme.divider)};
  background: ${({ theme, $active }) =>
    $active ? `${theme.accent}18` : theme.backgroundSecondary};
  color: ${({ theme, $active }) =>
    $active ? theme.accent : theme.textSecondary};
`;

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
`;

const FileInputLabel = styled.label`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 18px 14px;
  border-radius: 8px;
  border: 1.5px dashed ${({ theme }) => theme.divider};
  background: ${({ theme }) => theme.backgroundSecondary};
  cursor: pointer;
  text-align: center;
  transition: border-color 120ms ease;

  &:hover {
    border-color: ${({ theme }) => theme.accent};
  }

  input {
    display: none;
  }
`;

const UrlRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SectionDivider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.divider};
`;

const SettingsLinkButton = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.accent};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid ${({ theme }) => theme.divider};
`;

interface FeedData {
  requestKey: string;
  httpUrl: string;
  webcalUrl: string;
}

/**
 * Modal providing:
 * 1) Live CalDAV / iCal subscription feed URL & .ics export (filtered by sidebar selection)
 * 2) Two-way / One-way CalDAV synchronization with external CalDAV servers
 * 3) Direct .ics file import with Tag & Color mapping
 *
 * @param props Component properties.
 * @returns The rendered modal component.
 */
function CalendarSubscriptionModal({
  isOpen,
  visibleTags,
  includeUntagged,
  hasSidebarFilter,
  visibleEventCount,
  onExportICal,
  onRequestClose,
}: Props) {
  const { t } = useTranslation();
  const { auth, calendarEvents } = useStores();
  const [activeTab, setActiveTab] = React.useState<ModalTab>("feed");

  // Feed tab state
  const [feedFilter, setFeedFilter] = React.useState<string>("all");
  const [applySidebarSelection, setApplySidebarSelection] =
    React.useState<boolean>(true);
  const [feedData, setFeedData] = React.useState<FeedData | null>(null);

  // Sync tab state
  const [isSyncing, setIsSyncing] = React.useState(false);

  // Import .ics tab state
  const [importedFileName, setImportedFileName] = React.useState("");
  const [importedIcsContent, setImportedIcsContent] = React.useState("");
  const [importTags, setImportTags] = React.useState<string[]>([]);
  const [importColor, setImportColor] = React.useState<string>(
    PRESET_COLORS[0]
  );
  const [isImporting, setIsImporting] = React.useState(false);

  const shouldFilterByTags = applySidebarSelection && hasSidebarFilter;
  const requestKey = `${feedFilter}|${shouldFilterByTags ? visibleTags.join(",") : "*"}|${shouldFilterByTags ? String(includeUntagged) : "*"}`;

  const allCategoryTags = React.useMemo(() => {
    const tags: string[] = [];
    for (const cat of calendarEvents.settings.categories) {
      for (const tag of cat.tags) {
        if (!tags.some((tItem) => tItem.toLowerCase() === tag.toLowerCase())) {
          tags.push(tag);
        }
      }
    }
    return tags;
  }, [calendarEvents.settings.categories]);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isMounted = true;

    const payload: {
      filter: string;
      tags?: string[];
      includeUntagged?: boolean;
    } = {
      filter: feedFilter,
    };

    if (shouldFilterByTags) {
      payload.tags = visibleTags;
      payload.includeUntagged = includeUntagged;
    }

    void client
      .post("/calendarEvents.feed_url", payload)
      .then((res) => {
        if (isMounted && res?.data) {
          const data = res.data as { httpUrl: string; webcalUrl: string };
          setFeedData({
            requestKey,
            httpUrl: data.httpUrl,
            webcalUrl: data.webcalUrl,
          });
        }
      })
      .catch(() => {
        // Ignore error
      });

    return () => {
      isMounted = false;
    };
  }, [
    isOpen,
    feedFilter,
    shouldFilterByTags,
    visibleTags,
    includeUntagged,
    requestKey,
  ]);

  const isLoading = !feedData || feedData.requestKey !== requestKey;
  const httpUrl = !isLoading ? feedData.httpUrl : "";
  const webcalUrl = !isLoading ? feedData.webcalUrl : "";

  const filterOptions: Option[] = React.useMemo(
    () => [
      {
        type: "item",
        value: "all",
        label: t("All workspace events"),
        description: t("Subscribe to all events in the workspace calendar"),
      },
      {
        type: "item",
        value: "assigned",
        label: t("Assigned to me"),
        description: t("Only include events assigned to you"),
      },
      {
        type: "item",
        value: "mine",
        label: t("Created by me"),
        description: t("Only include events you created"),
      },
    ],
    [t]
  );

  const handleCopyUrl = async () => {
    if (!httpUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(httpUrl);
      toast.success(t("Subscription URL copied to clipboard."));
    } catch {
      toast.error(t("Could not copy URL."));
    }
  };

  const handleOpenWebcal = () => {
    if (!webcalUrl) {
      return;
    }
    window.location.href = webcalUrl;
  };

  const handleSyncCaldav = async (connId?: string) => {
    setIsSyncing(true);
    try {
      const stats = await calendarEvents.syncCaldav(connId);
      toast.success(
        t(
          "CalDAV synced: {{imported}} imported, {{updated}} updated, {{pushed}} pushed.",
          {
            imported: stats.imported,
            updated: stats.updated,
            pushed: stats.pushed ?? 0,
          }
        )
      );
    } catch {
      toast.error(
        t("CalDAV sync failed. Please check the connection settings.")
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    setImportedFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImportedIcsContent(reader.result);
      }
    };
    reader.readAsText(file);
  };

  const handleImportIcsSubmit = async () => {
    if (!importedIcsContent.trim()) {
      toast.error(t("Please select a .ics file to import."));
      return;
    }

    setIsImporting(true);
    try {
      const stats = await calendarEvents.importIcs({
        icsContent: importedIcsContent,
        defaultTags: importTags,
        defaultColor: importColor,
      });
      toast.success(
        t(
          "Imported {{imported}} new events and updated {{updated}} existing events.",
          {
            imported: stats.imported,
            updated: stats.updated,
          }
        )
      );
      setImportedFileName("");
      setImportedIcsContent("");
      onRequestClose();
    } catch {
      toast.error(
        t("Could not import .ics file. Please check the file format.")
      );
    } finally {
      setIsImporting(false);
    }
  };

  const connections = calendarEvents.settings.caldavConnections ?? [];
  const isAdmin = Boolean(auth.user?.isAdmin);

  return (
    <Modal
      isOpen={isOpen}
      title={t("CalDAV Sync, Import & Export")}
      onRequestClose={onRequestClose}
      width="500px"
    >
      <Container>
        <TabsBar>
          <TabButton
            type="button"
            $active={activeTab === "feed"}
            onClick={() => setActiveTab("feed")}
          >
            <GlobeIcon size={14} />
            {t("Feed & Export")}
          </TabButton>
          <TabButton
            type="button"
            $active={activeTab === "sync"}
            onClick={() => setActiveTab("sync")}
          >
            <RestoreIcon size={14} />
            {t("CalDAV Sync")}
          </TabButton>
          <TabButton
            type="button"
            $active={activeTab === "import"}
            onClick={() => setActiveTab("import")}
          >
            <ImportIcon size={14} />
            {t("Import .ics")}
          </TabButton>
        </TabsBar>

        {activeTab === "feed" ? (
          <>
            <InfoBox>
              <GlobeIcon size={18} />
              <Text size="small" type="secondary">
                {t(
                  "Subscribe to this feed URL in Apple Calendar, Google Calendar, Outlook, or any CalDAV/iCal client to keep your calendar automatically synced."
                )}
              </Text>
            </InfoBox>

            <InputSelect
              label={t("Events to include in feed")}
              value={feedFilter}
              options={filterOptions}
              onChange={setFeedFilter}
            />

            <SelectionCard>
              <Flex align="center" justify="space-between" gap={8}>
                <Text size="small" weight="bold">
                  {t("Only include selected sidebar categories & tags")}
                </Text>
                <Switch
                  checked={applySidebarSelection}
                  onChange={setApplySidebarSelection}
                  height={18}
                  width={34}
                />
              </Flex>
              {applySidebarSelection && hasSidebarFilter ? (
                <TagsPreviewRow>
                  {visibleTags.map((tag) => (
                    <TagPill key={tag}>
                      <HashtagIcon size={11} />
                      {tag}
                    </TagPill>
                  ))}
                  {includeUntagged ? (
                    <TagPill>{t("Untagged events")}</TagPill>
                  ) : null}
                  {visibleTags.length === 0 && !includeUntagged ? (
                    <Text size="xsmall" type="danger">
                      {t("No categories or tags are currently selected.")}
                    </Text>
                  ) : null}
                </TagsPreviewRow>
              ) : (
                <Text size="xsmall" type="tertiary">
                  {t("All categories and tags are currently included.")}
                </Text>
              )}
            </SelectionCard>

            <Flex column gap={6}>
              <Text as="label" size="small" weight="bold">
                {t("CalDAV / iCal Feed URL")}
              </Text>
              <UrlRow>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Input
                    value={isLoading ? t("Generating feed URL…") : httpUrl}
                    readOnly
                    margin={0}
                  />
                </div>
                <Button
                  type="button"
                  neutral
                  onClick={handleCopyUrl}
                  disabled={!httpUrl || isLoading}
                  icon={<CopyIcon />}
                >
                  {t("Copy")}
                </Button>
              </UrlRow>
            </Flex>

            <Flex gap={8} wrap>
              <Button
                type="button"
                onClick={handleOpenWebcal}
                disabled={!webcalUrl || isLoading}
                icon={<OpenIcon />}
              >
                {t("Subscribe in Calendar App (webcal://)")}
              </Button>
            </Flex>

            <SectionDivider />

            <Flex align="center" justify="space-between" gap={12} wrap>
              <Flex column gap={2}>
                <Text size="small" weight="bold">
                  {t("Download static .ics file")}
                </Text>
                <Text size="xsmall" type="tertiary">
                  {t(
                    "Export {{count}} selected events from the current month",
                    {
                      count: visibleEventCount,
                    }
                  )}
                </Text>
              </Flex>
              <Button
                type="button"
                neutral
                onClick={onExportICal}
                icon={<DownloadIcon />}
              >
                {t("Download .ics")}
              </Button>
            </Flex>
          </>
        ) : null}

        {activeTab === "sync" ? (
          <>
            <InfoBox>
              <RestoreIcon size={18} />
              <Text size="small" type="secondary">
                {t(
                  "Synchronize external CalDAV servers and .ics feeds with Outline. Events are mapped by UID, CATEGORIES ↔ Tags, and ATTENDEE ↔ Assigned Users so both sides stay in sync."
                )}
              </Text>
            </InfoBox>

            {connections.length === 0 ? (
              <SelectionCard>
                <Text size="small" weight="bold">
                  {t("No external CalDAV connections configured yet")}
                </Text>
                <Text size="xsmall" type="secondary">
                  {t(
                    "Connect Nextcloud, Apple iCloud, Fastmail, Google Calendar, or any CalDAV server in Workspace Calendar Settings."
                  )}
                </Text>
                {isAdmin ? (
                  <div style={{ marginTop: 4 }}>
                    <SettingsLinkButton
                      to={settingsPath("calendar")}
                      onClick={onRequestClose}
                    >
                      <SettingsIcon size={14} />
                      {t("Configure CalDAV connections in Settings")}
                    </SettingsLinkButton>
                  </div>
                ) : null}
              </SelectionCard>
            ) : (
              <Flex column gap={10}>
                {connections.map((conn) => (
                  <ConnectionRow key={conn.id} $color={conn.defaultColor}>
                    <Flex column gap={4} style={{ minWidth: 0, flex: 1 }}>
                      <Text size="small" weight="bold" ellipsis>
                        {conn.name}
                      </Text>
                      <Text size="xsmall" type="tertiary" ellipsis>
                        {conn.syncDirection === "bidirectional"
                          ? t("Two-Way CalDAV Sync")
                          : t("One-Way Import & Sync")}
                        {conn.defaultTags.length > 0
                          ? ` · #${conn.defaultTags.join(", #")}`
                          : ""}
                      </Text>
                    </Flex>
                    <Button
                      type="button"
                      neutral
                      disabled={isSyncing}
                      onClick={() => handleSyncCaldav(conn.id)}
                      icon={<RestoreIcon />}
                    >
                      {isSyncing ? t("Syncing…") : t("Sync")}
                    </Button>
                  </ConnectionRow>
                ))}

                <Flex align="center" justify="space-between" wrap gap={8}>
                  {isAdmin ? (
                    <SettingsLinkButton
                      to={settingsPath("calendar")}
                      onClick={onRequestClose}
                    >
                      <SettingsIcon size={14} />
                      {t("Manage connections & tag mappings")}
                    </SettingsLinkButton>
                  ) : (
                    <div />
                  )}
                  <Button
                    type="button"
                    disabled={isSyncing}
                    onClick={() => handleSyncCaldav()}
                    icon={<RestoreIcon />}
                  >
                    {isSyncing ? t("Syncing all…") : t("Sync All Now")}
                  </Button>
                </Flex>
              </Flex>
            )}
          </>
        ) : null}

        {activeTab === "import" ? (
          <>
            <InfoBox>
              <ImportIcon size={18} />
              <Text size="small" type="secondary">
                {t(
                  "Import an .ics calendar file and map its events to Outline categories/tags. Re-importing the same file updates existing events by UID without creating duplicates."
                )}
              </Text>
            </InfoBox>

            <FileInputLabel>
              <ImportIcon size={22} />
              <Text size="small" weight="bold">
                {importedFileName
                  ? importedFileName
                  : t("Click to choose a .ics calendar file")}
              </Text>
              <Text size="xsmall" type="tertiary">
                {t("Supports standard RFC 5545 iCalendar (.ics) files")}
              </Text>
              <input
                type="file"
                accept=".ics,text/calendar"
                onChange={handleFileChange}
              />
            </FileInputLabel>

            <Flex column gap={6}>
              <Text size="small" weight="bold">
                {t("Map imported events to Tags / Categories")}
              </Text>
              <TagsPreviewRow>
                {allCategoryTags.map((tag) => {
                  const isSelected = importTags.some(
                    (tItem) => tItem.toLowerCase() === tag.toLowerCase()
                  );
                  return (
                    <SelectableTagButton
                      key={tag}
                      type="button"
                      $active={isSelected}
                      onClick={() =>
                        setImportTags((prev) =>
                          isSelected
                            ? prev.filter(
                                (tItem) =>
                                  tItem.toLowerCase() !== tag.toLowerCase()
                              )
                            : [...prev, tag]
                        )
                      }
                    >
                      <HashtagIcon size={11} />
                      {tag}
                    </SelectableTagButton>
                  );
                })}
              </TagsPreviewRow>
            </Flex>

            <Flex column gap={6}>
              <Text size="small" weight="bold">
                {t("Event Color for Imported Events")}
              </Text>
              <SwatchRow>
                {PRESET_COLORS.map((color) => {
                  const isSelected =
                    importColor.toLowerCase() === color.toLowerCase();
                  return (
                    <SwatchButton
                      key={color}
                      type="button"
                      $color={color}
                      $selected={isSelected}
                      onClick={() => setImportColor(color)}
                      aria-label={color}
                    >
                      {isSelected ? <CheckmarkIcon size={12} /> : null}
                    </SwatchButton>
                  );
                })}
              </SwatchRow>
            </Flex>

            <Flex justify="flex-end">
              <Button
                type="button"
                disabled={!importedIcsContent || isImporting}
                onClick={handleImportIcsSubmit}
                icon={<ImportIcon />}
              >
                {isImporting ? t("Importing…") : t("Import & Sync Events")}
              </Button>
            </Flex>
          </>
        ) : null}

        <Footer>
          <div />
          <Button type="button" neutral onClick={onRequestClose}>
            {t("Done")}
          </Button>
        </Footer>
      </Container>
    </Modal>
  );
}

export default observer(CalendarSubscriptionModal);
