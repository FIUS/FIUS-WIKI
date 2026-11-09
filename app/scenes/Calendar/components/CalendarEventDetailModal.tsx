import { observer } from "mobx-react";
import * as React from "react";
import { format } from "date-fns";
import {
  TrashIcon,
  EditIcon,
  CollectionIcon,
  DocumentIcon,
  DownloadIcon,
  CalendarIcon,
  GroupIcon,
  HashtagIcon,
  PadlockIcon,
  RestoreIcon,
  TeamIcon,
  UserIcon,
  OpenIcon,
} from "outline-icons";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import styled from "styled-components";
import { CalendarEventPermissionType } from "@shared/types";
import Button from "~/components/Button";
import Flex from "~/components/Flex";
import Modal from "~/components/Modal";
import Text from "~/components/Text";
import usePolicy from "~/hooks/usePolicy";
import useStores from "~/hooks/useStores";
import type CalendarEvent from "~/models/CalendarEvent";
import { documentPath } from "~/utils/routeHelpers";
import { downloadICalendar } from "../utils/ical";
import { formatRecurrenceLabel } from "../utils/recurrence";

interface Props {
  /** Whether the details modal is open */
  isOpen: boolean;
  /** The calendar event to display details for */
  event: CalendarEvent | null;
  /** Callback to transition to the edit modal */
  onEdit: (event: CalendarEvent) => void;
  /** Callback to close the modal */
  onRequestClose: () => void;
}

const DetailContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  padding: 4px 0 0;
`;

const EventBanner = styled.div<{ $color?: string | null }>`
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 8px;
  background: ${({ $color, theme }) =>
    $color ? `${$color}14` : theme.backgroundSecondary};
  border: 1px solid
    ${({ $color, theme }) => ($color ? `${$color}30` : theme.divider)};
  border-left: 4px solid ${({ $color, theme }) => $color || theme.accent};
`;

const BannerContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  flex: 1;
`;

const EventTitle = styled.h2`
  margin: 0;
  font-size: 19px;
  font-weight: 600;
  line-height: 1.3;
  color: ${({ theme }) => theme.text};
  word-break: break-word;
`;

const DateTimeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  color: ${({ theme }) => theme.textSecondary};
`;

const AllDayBadge = styled.span<{ $color?: string | null }>`
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: ${({ $color, theme }) => $color || theme.accent};
  background: ${({ $color, theme }) =>
    $color ? `${$color}20` : `${theme.accent}18`};
`;

const MetaList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  background: ${({ theme }) => theme.backgroundSecondary};
  border: 1px solid ${({ theme }) => theme.divider};
  border-radius: 8px;
`;

const MetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: ${({ theme }) => theme.textSecondary};

  svg {
    flex-shrink: 0;
    color: ${({ theme }) => theme.textTertiary};
  }
`;

const SectionBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const ChipsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
`;

const TagPill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.accent};
  background: ${({ theme }) => `${theme.accent}16`};
  border: 1px solid ${({ theme }) => `${theme.accent}35`};
`;

const AssigneePill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: ${({ theme }) => theme.text};
  background: ${({ theme }) => theme.backgroundSecondary};
  border: 1px solid ${({ theme }) => theme.divider};
`;

const ReferencesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const DescriptionBox = styled.div`
  white-space: pre-wrap;
  font-size: 14px;
  line-height: 1.55;
  color: ${({ theme }) => theme.text};
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.divider};
  background: ${({ theme }) => theme.background};
`;

const ReferenceCard = styled(Link)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 8px;
  border: 1px solid ${({ theme }) => theme.divider};
  background: ${({ theme }) => theme.backgroundSecondary};
  color: ${({ theme }) => theme.text};
  text-decoration: none;
  font-weight: 500;
  transition: background-color 120ms ease, border-color 120ms ease;

  &:hover {
    background: ${({ theme }) => theme.listItemHoverBackground};
    border-color: ${({ theme }) => theme.accent};
  }
`;

const ReferenceTypeBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${({ theme }) => theme.textTertiary};
  background: ${({ theme }) => theme.background};
  border: 1px solid ${({ theme }) => theme.divider};
  flex-shrink: 0;
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid ${({ theme }) => theme.divider};
`;

/**
 * Modal displaying full details of a calendar event with edit and delete actions.
 *
 * @param props Component properties.
 * @returns The rendered modal component.
 */
function CalendarEventDetailModal({
  isOpen,
  event,
  onEdit,
  onRequestClose,
}: Props) {
  const { t } = useTranslation();
  const { calendarEvents, collections, documents, groups, users } = useStores();
  const [confirmingDeleteId, setConfirmingDeleteId] = React.useState<
    string | null
  >(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const can = usePolicy(event);
  const isConfirmDeleteOpen = Boolean(
    event && confirmingDeleteId === event.id
  );

  React.useEffect(() => {
    if (!isOpen || !event) {
      return;
    }
    for (const colId of event.resolvedCollectionIds) {
      if (!collections.get(colId)) {
        void collections.fetch(colId);
      }
    }
    for (const docId of event.resolvedDocumentIds) {
      if (!documents.get(docId)) {
        void documents.fetch(docId);
      }
    }
    for (const userId of event.assigneeIds ?? []) {
      if (!users.get(userId)) {
        void users.fetch(userId);
      }
    }
  }, [isOpen, event, collections, documents, users]);

  if (!event) {
    return null;
  }

  const linkedCollections = event.resolvedCollectionIds
    .map((id) => collections.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  const linkedDocuments = event.resolvedDocumentIds
    .map((id) => documents.get(id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d));

  const assignedUsers = (event.assigneeIds ?? [])
    .map((id) => users.get(id))
    .filter((u): u is NonNullable<typeof u> => Boolean(u));

  const hasReferences =
    linkedCollections.length > 0 || linkedDocuments.length > 0;

  const linkedGroup = event.groupId ? groups.get(event.groupId) : null;
  const recurrenceSummary = formatRecurrenceLabel(event, t);

  const formattedDateTime = () => {
    try {
      const start = new Date(event.startAt);
      const end = new Date(event.endAt);

      if (event.allDay) {
        const startStr = format(start, "EEE, MMM d, yyyy");
        const endStr = format(end, "EEE, MMM d, yyyy");
        return startStr === endStr ? startStr : `${startStr} – ${endStr}`;
      }

      const sameDay =
        format(start, "yyyy-MM-dd") === format(end, "yyyy-MM-dd");
      if (sameDay) {
        return `${format(start, "EEE, MMM d, yyyy")} · ${format(start, "p")} – ${format(end, "p")}`;
      }

      return `${format(start, "MMM d, yyyy, p")} – ${format(end, "MMM d, yyyy, p")}`;
    } catch {
      return `${event.startAt} – ${event.endAt}`;
    }
  };

  const permissionLabel = () => {
    switch (event.permissionType) {
      case CalendarEventPermissionType.All:
        return t("Editable by everyone in workspace");
      case CalendarEventPermissionType.Group:
        return linkedGroup
          ? t("Editable by members of {{group}}", { group: linkedGroup.name })
          : t("Editable by specific group");
      case CalendarEventPermissionType.CreatorOrAdmin:
      default:
        return t("Editable by creator and workspace admins");
    }
  };

  const PermissionIcon =
    event.permissionType === CalendarEventPermissionType.All
      ? TeamIcon
      : event.permissionType === CalendarEventPermissionType.Group
        ? GroupIcon
        : PadlockIcon;

  const handleExportSingleICal = () => {
    const safeSlug =
      event.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "event";
    downloadICalendar([event], `${safeSlug}.ics`);
    toast.success(t("Event exported as .ics file."));
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await calendarEvents.delete(event);
      toast.success(t("Event deleted."));
      setConfirmingDeleteId(null);
      onRequestClose();
    } catch {
      toast.error(t("Could not delete event."));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      title={t("Event Details")}
      onRequestClose={onRequestClose}
      width="460px"
    >
      <DetailContainer>
        <EventBanner $color={event.color}>
          <BannerContent>
            <EventTitle>{event.title}</EventTitle>
            <DateTimeRow>
              <CalendarIcon size={15} />
              <Text size="small" type="secondary" weight="bold">
                {formattedDateTime()}
              </Text>
              {event.allDay ? (
                <AllDayBadge $color={event.color}>{t("All day")}</AllDayBadge>
              ) : null}
            </DateTimeRow>
          </BannerContent>
        </EventBanner>

        {event.tags && event.tags.length > 0 ? (
          <SectionBlock>
            <Text size="xsmall" type="tertiary" weight="bold">
              {t("TAGS & CATEGORIES")}
            </Text>
            <ChipsRow>
              {event.tags.map((tag) => (
                <TagPill key={tag}>
                  <HashtagIcon size={13} />
                  {tag}
                </TagPill>
              ))}
            </ChipsRow>
          </SectionBlock>
        ) : null}

        {assignedUsers.length > 0 ? (
          <SectionBlock>
            <Text size="xsmall" type="tertiary" weight="bold">
              {t("ASSIGNED TO")}
            </Text>
            <ChipsRow>
              {assignedUsers.map((user) => (
                <AssigneePill key={user.id}>
                  <UserIcon size={14} />
                  {user.name}
                </AssigneePill>
              ))}
            </ChipsRow>
          </SectionBlock>
        ) : null}

        {event.description ? (
          <SectionBlock>
            <Text size="xsmall" type="tertiary" weight="bold">
              {t("DESCRIPTION")}
            </Text>
            <DescriptionBox>{event.description}</DescriptionBox>
          </SectionBlock>
        ) : null}

        {hasReferences ? (
          <SectionBlock>
            <Text size="xsmall" type="tertiary" weight="bold">
              {t("REFERENCES")}
            </Text>
            <ReferencesList>
              {linkedCollections.map((col) => (
                <ReferenceCard
                  key={`col-${col.id}`}
                  to={col.path}
                  onClick={onRequestClose}
                >
                  <Flex align="center" gap={8} style={{ minWidth: 0, flex: 1 }}>
                    <CollectionIcon size={17} />
                    <Text size="small" weight="bold" ellipsis>
                      {col.displayName}
                    </Text>
                    <ReferenceTypeBadge>{t("Collection")}</ReferenceTypeBadge>
                  </Flex>
                  <OpenIcon size={16} />
                </ReferenceCard>
              ))}

              {linkedDocuments.map((doc) => (
                <ReferenceCard
                  key={`doc-${doc.id}`}
                  to={documentPath(doc)}
                  onClick={onRequestClose}
                >
                  <Flex align="center" gap={8} style={{ minWidth: 0, flex: 1 }}>
                    <DocumentIcon size={17} />
                    <Text size="small" weight="bold" ellipsis>
                      {doc.displayTitle}
                    </Text>
                    <ReferenceTypeBadge>{t("Document")}</ReferenceTypeBadge>
                  </Flex>
                  <OpenIcon size={16} />
                </ReferenceCard>
              ))}
            </ReferencesList>
          </SectionBlock>
        ) : null}

        <MetaList>
          {recurrenceSummary ? (
            <MetaRow>
              <RestoreIcon size={16} />
              <Text size="xsmall" type="secondary" weight="bold">
                {recurrenceSummary}
              </Text>
            </MetaRow>
          ) : null}
          {event.createdBy ? (
            <MetaRow>
              <UserIcon size={16} />
              <Text size="xsmall" type="secondary">
                {t("Created by {{name}}", { name: event.createdBy.name })}
              </Text>
            </MetaRow>
          ) : null}
          <MetaRow>
            <PermissionIcon size={16} />
            <Text size="xsmall" type="secondary">
              {permissionLabel()}
            </Text>
          </MetaRow>
        </MetaList>

        {isConfirmDeleteOpen ? (
          <Footer>
            <Text size="small" type="danger" weight="bold">
              {t("Are you sure you want to delete this event?")}
            </Text>
            <Flex gap={8}>
              <Button
                type="button"
                neutral
                onClick={() => setConfirmingDeleteId(null)}
              >
                {t("Cancel")}
              </Button>
              <Button
                type="button"
                danger
                disabled={isDeleting}
                onClick={handleDelete}
              >
                {isDeleting ? t("Deleting…") : t("Delete")}
              </Button>
            </Flex>
          </Footer>
        ) : (
          <Footer>
            <Flex gap={8}>
              {can.delete ? (
                <Button
                  type="button"
                  danger
                  neutral
                  onClick={() => setConfirmingDeleteId(event.id)}
                  icon={<TrashIcon />}
                >
                  {t("Delete")}
                </Button>
              ) : null}
              <Button
                type="button"
                neutral
                onClick={handleExportSingleICal}
                icon={<DownloadIcon />}
              >
                {t(".ics")}
              </Button>
            </Flex>

            <Flex gap={8}>
              <Button type="button" neutral onClick={onRequestClose}>
                {t("Close")}
              </Button>
              {can.update ? (
                <Button
                  type="button"
                  onClick={() => onEdit(event)}
                  icon={<EditIcon />}
                >
                  {t("Edit")}
                </Button>
              ) : null}
            </Flex>
          </Footer>
        )}
      </DetailContainer>
    </Modal>
  );
}

export default observer(CalendarEventDetailModal);
