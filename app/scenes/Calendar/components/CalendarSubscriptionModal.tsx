import * as React from "react";
import {
  CopyIcon,
  DownloadIcon,
  GlobeIcon,
  HashtagIcon,
  OpenIcon,
} from "outline-icons";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import styled from "styled-components";
import Button from "~/components/Button";
import Flex from "~/components/Flex";
import Input from "~/components/Input";
import { InputSelect, type Option } from "~/components/InputSelect";
import Modal from "~/components/Modal";
import Switch from "~/components/Switch";
import Text from "~/components/Text";
import { client } from "~/utils/ApiClient";

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

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  padding: 4px 0 0;
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

const UrlRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SectionDivider = styled.div`
  height: 1px;
  background: ${({ theme }) => theme.divider};
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
 * Modal providing a live CalDAV / iCal subscription feed URL and .ics snapshot download,
 * respecting the categories and tags selected in the right sidebar.
 *
 * @param props Component properties.
 * @returns The rendered modal component.
 */
export function CalendarSubscriptionModal({
  isOpen,
  visibleTags,
  includeUntagged,
  hasSidebarFilter,
  visibleEventCount,
  onExportICal,
  onRequestClose,
}: Props) {
  const { t } = useTranslation();
  const [feedFilter, setFeedFilter] = React.useState<string>("all");
  const [applySidebarSelection, setApplySidebarSelection] =
    React.useState<boolean>(true);
  const [feedData, setFeedData] = React.useState<FeedData | null>(null);

  const shouldFilterByTags = applySidebarSelection && hasSidebarFilter;
  const requestKey = `${feedFilter}|${shouldFilterByTags ? visibleTags.join(",") : "*"}|${shouldFilterByTags ? String(includeUntagged) : "*"}`;

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

  return (
    <Modal
      isOpen={isOpen}
      title={t("CalDAV / iCal Subscription & Export")}
      onRequestClose={onRequestClose}
      width="480px"
    >
      <Container>
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
              {t("Export {{count}} selected events from the current month", {
                count: visibleEventCount,
              })}
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

export default React.memo(CalendarSubscriptionModal);
