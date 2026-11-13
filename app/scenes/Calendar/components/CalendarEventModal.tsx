import { observer } from "mobx-react";
import * as React from "react";
import { format } from "date-fns";
import {
  CheckmarkIcon,
  CloseIcon,
  CollectionIcon,
  DocumentIcon,
  GroupIcon,
  HashtagIcon,
  PadlockIcon,
  PlusIcon,
  RestoreIcon,
  TeamIcon,
  UserIcon,
} from "outline-icons";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import styled from "styled-components";
import {
  CalendarEventPermissionType,
  CalendarEventRecurrenceFrequency,
} from "@shared/types";
import Button from "~/components/Button";
import Flex from "~/components/Flex";
import Input from "~/components/Input";
import { InputSelect, type Option } from "~/components/InputSelect";
import Modal from "~/components/Modal";
import Switch from "~/components/Switch";
import Text from "~/components/Text";
import useStores from "~/hooks/useStores";
import type CalendarEvent from "~/models/CalendarEvent";
import type Collection from "~/models/Collection";
import type Document from "~/models/Document";

interface Props {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** An existing event to edit, or null/undefined if creating a new event */
  event?: CalendarEvent | null;
  /** Default date when creating an event from clicking a calendar day */
  initialDate?: Date | null;
  /** Callback to close the modal */
  onRequestClose: () => void;
}

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

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  padding: 4px 0 0;
`;

const ScheduleCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 8px;
  background: ${({ theme }) => theme.backgroundSecondary};
  border: 1px solid ${({ theme }) => theme.divider};
`;

const ScheduleHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const DateGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
`;

const FieldColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
`;

const NativeInput = styled.input`
  display: block;
  width: 100%;
  height: 34px;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid ${({ theme }) => theme.inputBorder};
  background: ${({ theme }) => theme.background};
  color: ${({ theme }) => theme.text};
  color-scheme: ${({ theme }) => (theme.isDark ? "dark" : "light")};
  font-family: inherit;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 120ms ease;

  &:focus {
    border-color: ${({ theme }) => theme.inputBorderFocused};
  }
`;

const ColorPickerContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const SwatchRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
`;

const Swatch = styled.button<{ $color: string; $isSelected: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background-color: ${({ $color }) => $color};
  border: 2px solid
    ${({ $isSelected, theme }) =>
      $isSelected ? theme.background : "transparent"};
  box-shadow: ${({ $isSelected, $color }) =>
    $isSelected ? `0 0 0 2px ${$color}` : "0 1px 2px rgba(0, 0, 0, 0.15)"};
  color: #ffffff;
  cursor: pointer;
  padding: 0;
  transition:
    transform 120ms ease,
    box-shadow 120ms ease;

  &:hover {
    transform: scale(1.08);
  }
`;

const TagsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
`;

const TagChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: ${({ theme }) => theme.accent};
  background: ${({ theme }) => `${theme.accent}18`};
  border: 1px solid ${({ theme }) => `${theme.accent}40`};
`;

const PresetTagButton = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  border: 1px solid
    ${({ theme, $active }) => ($active ? theme.accent : theme.divider)};
  background: ${({ theme, $active }) =>
    $active ? `${theme.accent}18` : theme.backgroundSecondary};
  color: ${({ theme, $active }) =>
    $active ? theme.accent : theme.textSecondary};
  transition: all 120ms ease;

  &:hover {
    border-color: ${({ theme }) => theme.accent};
    color: ${({ theme, $active }) => ($active ? theme.accent : theme.text)};
  }
`;

const TagInputRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SelectedReferencesList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const SelectedReferenceCard = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  background: ${({ theme }) => theme.backgroundSecondary};
  border: 1px solid ${({ theme }) => theme.divider};
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
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

const RemoveRefButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: ${({ theme }) => theme.textSecondary};
  cursor: pointer;
  flex-shrink: 0;

  &:hover {
    color: ${({ theme }) => theme.text};
    background: ${({ theme }) => theme.divider};
  }
`;

const RemoveChipButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 0;

  &:hover {
    opacity: 0.75;
  }
`;

const SearchResultsList = styled.div`
  max-height: 160px;
  overflow-y: auto;
  border: 1px solid ${({ theme }) => theme.divider};
  border-radius: 6px;
  background: ${({ theme }) => theme.background};
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
`;

const SearchResultItem = styled.button`
  width: 100%;
  padding: 8px 10px;
  font-size: 13px;
  font-family: inherit;
  color: ${({ theme }) => theme.text};
  background: transparent;
  border: none;
  border-bottom: 1px solid ${({ theme }) => theme.divider};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  text-align: left;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: ${({ theme }) => theme.listItemHoverBackground};
  }
`;

const EmptyGroupNotice = styled.div`
  padding: 10px 12px;
  border-radius: 6px;
  background: ${({ theme }) => theme.backgroundSecondary};
  border: 1px solid ${({ theme }) => theme.divider};
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid ${({ theme }) => theme.divider};
`;

interface FormProps {
  event?: CalendarEvent | null;
  initialDate?: Date | null;
  onRequestClose: () => void;
}

type ReferenceSuggestion =
  | { kind: "collection"; collection: Collection }
  | { kind: "document"; document: Document };

const CalendarEventForm = observer(function CalendarEventForm({
  event,
  initialDate,
  onRequestClose,
}: FormProps) {
  const { t } = useTranslation();
  const { calendarEvents, collections, documents, groups, users } = useStores();

  const isEditing = Boolean(event);
  const baseDate = React.useMemo(
    () => (event ? new Date(event.startAt) : initialDate || new Date()),
    [event, initialDate],
  );
  const baseEndDate = React.useMemo(
    () => (event ? new Date(event.endAt) : initialDate || new Date()),
    [event, initialDate],
  );

  const [title, setTitle] = React.useState(() => event?.title ?? "");
  const [description, setDescription] = React.useState(
    () => event?.description ?? "",
  );
  const [allDay, setAllDay] = React.useState(() => event?.allDay ?? false);
  const [startDate, setStartDate] = React.useState(() =>
    format(baseDate, "yyyy-MM-dd"),
  );
  const [startTime, setStartTime] = React.useState(() =>
    event ? format(baseDate, "HH:mm") : "09:00",
  );
  const [endDate, setEndDate] = React.useState(() =>
    format(baseEndDate, "yyyy-MM-dd"),
  );
  const [endTime, setEndTime] = React.useState(() =>
    event ? format(baseEndDate, "HH:mm") : "10:00",
  );
  const [color, setColor] = React.useState<string>(
    () =>
      event?.color || calendarEvents.settings.defaultColor || PRESET_COLORS[0],
  );
  const [recurrenceFrequency, setRecurrenceFrequency] = React.useState<string>(
    () => event?.recurrenceFrequency ?? "none",
  );
  const [recurrenceEndDate, setRecurrenceEndDate] = React.useState<string>(
    () =>
      event?.recurrenceEndAt
        ? format(new Date(event.recurrenceEndAt), "yyyy-MM-dd")
        : "",
  );
  const [permissionType, setPermissionType] =
    React.useState<CalendarEventPermissionType>(
      () =>
        event?.permissionType ??
        calendarEvents.settings.defaultPermissionType ??
        CalendarEventPermissionType.CreatorOrAdmin,
    );
  const [groupId, setGroupId] = React.useState<string | null>(
    () => event?.groupId ?? null,
  );

  // Tags / Categories
  const [selectedTags, setSelectedTags] = React.useState<string[]>(() =>
    event?.tags ? [...event.tags] : [],
  );
  const [customTagInput, setCustomTagInput] = React.useState("");

  // Assigned Users
  const [selectedAssigneeIds, setSelectedAssigneeIds] = React.useState<
    string[]
  >(() => (event?.assigneeIds ? [...event.assigneeIds] : []));
  const [assigneeSearchQuery, setAssigneeSearchQuery] = React.useState("");
  const [isAssigneeSearchFocused, setIsAssigneeSearchFocused] =
    React.useState(false);

  // Multiple linked collections & documents tracked by ID
  const [selectedCollectionIds, setSelectedCollectionIds] = React.useState<
    string[]
  >(() => (event ? [...event.resolvedCollectionIds] : []));
  const [selectedDocumentIds, setSelectedDocumentIds] = React.useState<
    string[]
  >(() => (event ? [...event.resolvedDocumentIds] : []));

  const [refSearchQuery, setRefSearchQuery] = React.useState("");
  const [isRefSearchFocused, setIsRefSearchFocused] = React.useState(false);
  const [searchedDocs, setSearchedDocs] = React.useState<Document[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    void groups.fetchPage({});
    void collections.fetchPage({ limit: 100 });
    void users.fetchPage({ limit: 100 });
  }, [groups, collections, users]);

  // Ensure any initially referenced collections, documents, and assignees are loaded into stores
  React.useEffect(() => {
    if (!event) {
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
  }, [event, collections, documents, users]);

  React.useEffect(() => {
    if (!refSearchQuery.trim()) {
      setSearchedDocs([]);
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      try {
        const results = await documents.searchTitles({
          query: refSearchQuery,
          limit: 6,
        });
        if (isMounted) {
          setSearchedDocs(results.map((r) => r.document));
        }
      } catch {
        // Ignore search error
      }
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [refSearchQuery, documents]);

  const displayedSuggestions: ReferenceSuggestion[] = React.useMemo(() => {
    const query = refSearchQuery.trim().toLowerCase();
    if (!query && !isRefSearchFocused) {
      return [];
    }

    const matchingCollections = collections.orderedData
      .filter(
        (col) =>
          col.isActive &&
          !selectedCollectionIds.includes(col.id) &&
          (!query || col.displayName.toLowerCase().includes(query)),
      )
      .slice(0, query ? 4 : 3)
      .map((collection): ReferenceSuggestion => ({
        kind: "collection",
        collection,
      }));

    const candidateDocs = query
      ? searchedDocs
      : documents.orderedData.slice(0, 6);

    const matchingDocs = candidateDocs
      .filter((doc) => !selectedDocumentIds.includes(doc.id))
      .slice(0, 5)
      .map((document): ReferenceSuggestion => ({
        kind: "document",
        document,
      }));

    return [...matchingCollections, ...matchingDocs];
  }, [
    refSearchQuery,
    isRefSearchFocused,
    collections.orderedData,
    selectedCollectionIds,
    searchedDocs,
    documents.orderedData,
    selectedDocumentIds,
  ]);

  const displayedAssigneeSuggestions = React.useMemo(() => {
    const query = assigneeSearchQuery.trim().toLowerCase();
    if (!query && !isAssigneeSearchFocused) {
      return [];
    }

    return users.activeOrInvited
      .filter(
        (u) =>
          !selectedAssigneeIds.includes(u.id) &&
          (!query ||
            u.name.toLowerCase().includes(query) ||
            (u.email ?? "").toLowerCase().includes(query)),
      )
      .slice(0, 6);
  }, [
    assigneeSearchQuery,
    isAssigneeSearchFocused,
    users.activeOrInvited,
    selectedAssigneeIds,
  ]);

  const handleToggleTag = React.useCallback((tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) {
      return;
    }
    setSelectedTags((prev) =>
      prev.some((tItem) => tItem.toLowerCase() === trimmed.toLowerCase())
        ? prev.filter((tItem) => tItem.toLowerCase() !== trimmed.toLowerCase())
        : [...prev, trimmed],
    );
  }, []);

  const handleAddCustomTag = React.useCallback(() => {
    const cleaned = customTagInput.trim().replace(/^#+/, "");
    if (!cleaned) {
      return;
    }
    setSelectedTags((prev) =>
      prev.some((tItem) => tItem.toLowerCase() === cleaned.toLowerCase())
        ? prev
        : [...prev, cleaned],
    );
    setCustomTagInput("");
  }, [customTagInput]);

  const handleRemoveTag = React.useCallback((tag: string) => {
    setSelectedTags((prev) => prev.filter((tItem) => tItem !== tag));
  }, []);

  const handleAddAssignee = React.useCallback((userId: string) => {
    setSelectedAssigneeIds((prev) =>
      prev.includes(userId) ? prev : [...prev, userId],
    );
    setAssigneeSearchQuery("");
  }, []);

  const handleRemoveAssignee = React.useCallback((userId: string) => {
    setSelectedAssigneeIds((prev) => prev.filter((id) => id !== userId));
  }, []);

  const handleAddCollection = React.useCallback((colId: string) => {
    setSelectedCollectionIds((prev) =>
      prev.includes(colId) ? prev : [...prev, colId],
    );
    setRefSearchQuery("");
  }, []);

  const handleRemoveCollection = React.useCallback((colId: string) => {
    setSelectedCollectionIds((prev) => prev.filter((id) => id !== colId));
  }, []);

  const handleAddDocument = React.useCallback((docId: string) => {
    setSelectedDocumentIds((prev) =>
      prev.includes(docId) ? prev : [...prev, docId],
    );
    setRefSearchQuery("");
    setSearchedDocs([]);
  }, []);

  const handleRemoveDocument = React.useCallback((docId: string) => {
    setSelectedDocumentIds((prev) => prev.filter((id) => id !== docId));
  }, []);

  const handleTitleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(e.target.value);
    },
    [],
  );

  const handleDescriptionChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setDescription(e.target.value);
    },
    [],
  );

  const handlePermissionChange = React.useCallback(
    (val: string) => {
      const nextPermission = val as CalendarEventPermissionType;
      setPermissionType(nextPermission);
      if (
        nextPermission === CalendarEventPermissionType.Group &&
        !groupId &&
        groups.orderedData.length > 0
      ) {
        setGroupId(groups.orderedData[0].id);
      }
    },
    [groupId, groups.orderedData],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error(t("Please provide a title for the event."));
      return;
    }

    if (!startDate || !endDate) {
      toast.error(t("Please specify both start and end dates."));
      return;
    }

    if (permissionType === CalendarEventPermissionType.Group && !groupId) {
      toast.error(t("Please select a group for this permission setting."));
      return;
    }

    let startIso: string;
    let endIso: string;

    if (allDay) {
      startIso = new Date(`${startDate}T00:00:00`).toISOString();
      endIso = new Date(`${endDate}T23:59:59.999`).toISOString();
    } else {
      startIso = new Date(
        `${startDate}T${startTime || "00:00"}:00`,
      ).toISOString();
      endIso = new Date(`${endDate}T${endTime || "00:00"}:00`).toISOString();
    }

    if (new Date(startIso).getTime() > new Date(endIso).getTime()) {
      toast.error(t("End date must be after the start date."));
      return;
    }

    const activeRecurrence =
      recurrenceFrequency === "none"
        ? null
        : (recurrenceFrequency as CalendarEventRecurrenceFrequency);

    let recurrenceEndIso: string | null = null;
    if (activeRecurrence && recurrenceEndDate) {
      recurrenceEndIso = new Date(
        `${recurrenceEndDate}T23:59:59.999`,
      ).toISOString();
      if (new Date(recurrenceEndIso).getTime() < new Date(startIso).getTime()) {
        toast.error(t("Repeat end date must be after the start date."));
        return;
      }
    }

    setIsSaving(true);

    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        startAt: startIso,
        endAt: endIso,
        allDay,
        color,
        tags: selectedTags,
        assigneeIds: selectedAssigneeIds,
        recurrenceFrequency: activeRecurrence,
        recurrenceEndAt: recurrenceEndIso,
        collectionIds: selectedCollectionIds,
        collectionId: selectedCollectionIds[0] ?? null,
        documentIds: selectedDocumentIds,
        documentId: selectedDocumentIds[0] ?? null,
        permissionType,
        groupId:
          permissionType === CalendarEventPermissionType.Group
            ? groupId || null
            : null,
      };

      if (isEditing && event) {
        await calendarEvents.save({
          id: event.id,
          ...payload,
        });
        toast.success(t("Event updated."));
      } else {
        await calendarEvents.save(payload);
        toast.success(t("Event created."));
      }

      onRequestClose();
    } catch {
      toast.error(t("Failed to save event."));
    } finally {
      setIsSaving(false);
    }
  };

  const recurrenceOptions: Option[] = React.useMemo(
    () => [
      {
        type: "item",
        value: "none",
        label: t("Does not repeat"),
      },
      {
        type: "item",
        value: CalendarEventRecurrenceFrequency.Daily,
        label: t("Daily"),
        icon: <RestoreIcon />,
      },
      {
        type: "item",
        value: CalendarEventRecurrenceFrequency.Weekdays,
        label: t("Every weekday (Mon–Fri)"),
        icon: <RestoreIcon />,
      },
      {
        type: "item",
        value: CalendarEventRecurrenceFrequency.Weekly,
        label: t("Weekly"),
        icon: <RestoreIcon />,
      },
      {
        type: "item",
        value: CalendarEventRecurrenceFrequency.Biweekly,
        label: t("Every 2 weeks"),
        icon: <RestoreIcon />,
      },
      {
        type: "item",
        value: CalendarEventRecurrenceFrequency.Monthly,
        label: t("Monthly"),
        icon: <RestoreIcon />,
      },
      {
        type: "item",
        value: CalendarEventRecurrenceFrequency.Yearly,
        label: t("Yearly"),
        icon: <RestoreIcon />,
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
        icon: <PadlockIcon />,
      },
      {
        type: "item",
        value: CalendarEventPermissionType.All,
        label: t("Everyone in Workspace"),
        icon: <TeamIcon />,
      },
      {
        type: "item",
        value: CalendarEventPermissionType.Group,
        label: t("Specific Group"),
        icon: <GroupIcon />,
      },
    ],
    [t],
  );

  const groupOptions: Option[] = React.useMemo(
    () =>
      groups.orderedData.map((g) => ({
        type: "item",
        value: g.id,
        label: g.name,
        icon: <GroupIcon />,
      })),
    [groups.orderedData],
  );

  const hasSelectedRefs =
    selectedCollectionIds.length > 0 || selectedDocumentIds.length > 0;

  return (
    <Form onSubmit={handleSubmit}>
      <Input
        label={t("Title")}
        placeholder={t("Team sync, Product launch, Company offsite...")}
        value={title}
        onChange={handleTitleChange}
        required
        autoFocus
      />

      <ScheduleCard>
        <ScheduleHeader>
          <Text size="small" weight="bold">
            {t("Date & Time")}
          </Text>
          <Switch
            label={t("All-day")}
            checked={allDay}
            onChange={setAllDay}
            height={18}
            width={34}
          />
        </ScheduleHeader>

        <DateGrid>
          <FieldColumn>
            <Text as="label" size="xsmall" type="secondary" weight="bold">
              {t("Starts")}
            </Text>
            <NativeInput
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (endDate && e.target.value > endDate) {
                  setEndDate(e.target.value);
                }
              }}
              required
            />
            {!allDay ? (
              <NativeInput
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            ) : null}
          </FieldColumn>

          <FieldColumn>
            <Text as="label" size="xsmall" type="secondary" weight="bold">
              {t("Ends")}
            </Text>
            <NativeInput
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
            {!allDay ? (
              <NativeInput
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            ) : null}
          </FieldColumn>
        </DateGrid>

        <DateGrid>
          <FieldColumn>
            <InputSelect
              label={t("Repeat")}
              value={recurrenceFrequency}
              options={recurrenceOptions}
              onChange={setRecurrenceFrequency}
            />
          </FieldColumn>

          {recurrenceFrequency !== "none" ? (
            <FieldColumn>
              <Text as="label" size="small" weight="bold">
                {t("Repeat until (optional)")}
              </Text>
              <NativeInput
                type="date"
                value={recurrenceEndDate}
                min={startDate}
                onChange={(e) => setRecurrenceEndDate(e.target.value)}
              />
            </FieldColumn>
          ) : null}
        </DateGrid>
      </ScheduleCard>

      <ColorPickerContainer>
        <Text as="label" size="small" weight="bold">
          {t("Event Color")}
        </Text>
        <SwatchRow>
          {PRESET_COLORS.map((c) => {
            const isSelected = color.toLowerCase() === c.toLowerCase();
            return (
              <Swatch
                key={c}
                type="button"
                $color={c}
                $isSelected={isSelected}
                onClick={() => setColor(c)}
                aria-label={c}
              >
                {isSelected ? <CheckmarkIcon size={14} /> : null}
              </Swatch>
            );
          })}
        </SwatchRow>
      </ColorPickerContainer>

      <Flex column gap={8}>
        <Text as="label" size="small" weight="bold">
          {t("Tags & Categories")}
        </Text>

        {calendarEvents.settings.categories.map((cat) =>
          cat.tags.length > 0 ? (
            <Flex key={cat.id} column gap={4}>
              <Text size="xsmall" type="tertiary" weight="bold">
                {cat.name}
              </Text>
              <TagsRow>
                {cat.tags.map((preset) => {
                  const isSelected = selectedTags.some(
                    (tItem) => tItem.toLowerCase() === preset.toLowerCase(),
                  );
                  return (
                    <PresetTagButton
                      key={preset}
                      type="button"
                      $active={isSelected}
                      onClick={() => handleToggleTag(preset)}
                    >
                      <HashtagIcon size={12} />
                      {preset}
                    </PresetTagButton>
                  );
                })}
              </TagsRow>
            </Flex>
          ) : null,
        )}

        {selectedTags.length > 0 ? (
          <TagsRow>
            {selectedTags.map((tag) => (
              <TagChip key={tag}>
                <HashtagIcon size={12} />
                {tag}
                <RemoveChipButton
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  aria-label={t("Remove tag")}
                >
                  <CloseIcon size={12} />
                </RemoveChipButton>
              </TagChip>
            ))}
          </TagsRow>
        ) : null}

        {calendarEvents.settings.allowCustomTags ? (
          <TagInputRow>
            <div style={{ flex: 1 }}>
              <Input
                placeholder={t("Add custom tag or category...")}
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    handleAddCustomTag();
                  }
                }}
                margin={0}
              />
            </div>
            <Button
              type="button"
              neutral
              onClick={handleAddCustomTag}
              disabled={!customTagInput.trim()}
              icon={<PlusIcon />}
            >
              {t("Add")}
            </Button>
          </TagInputRow>
        ) : null}
      </Flex>

      <Flex column gap={8}>
        <Text as="label" size="small" weight="bold">
          {t("Assigned Users")}
        </Text>

        {selectedAssigneeIds.length > 0 ? (
          <SelectedReferencesList>
            {selectedAssigneeIds.map((userId) => {
              const user = users.get(userId);
              return (
                <SelectedReferenceCard key={`user-${userId}`}>
                  <Flex align="center" gap={8} style={{ minWidth: 0, flex: 1 }}>
                    <UserIcon size={16} />
                    <Text size="small" weight="bold" ellipsis>
                      {user?.name ?? t("User")}
                    </Text>
                    <ReferenceTypeBadge>{t("Assignee")}</ReferenceTypeBadge>
                  </Flex>
                  <RemoveRefButton
                    type="button"
                    onClick={() => handleRemoveAssignee(userId)}
                    aria-label={t("Remove assignee")}
                    title={t("Remove")}
                  >
                    <CloseIcon size={16} />
                  </RemoveRefButton>
                </SelectedReferenceCard>
              );
            })}
          </SelectedReferencesList>
        ) : null}

        <Input
          placeholder={t("Search team members to assign...")}
          value={assigneeSearchQuery}
          onFocus={() => setIsAssigneeSearchFocused(true)}
          onBlur={() => {
            setTimeout(() => setIsAssigneeSearchFocused(false), 180);
          }}
          onChange={(e) => setAssigneeSearchQuery(e.target.value)}
          margin={0}
        />

        {displayedAssigneeSuggestions.length > 0 ? (
          <SearchResultsList>
            {displayedAssigneeSuggestions.map((user) => (
              <SearchResultItem
                key={`assignee-${user.id}`}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleAddAssignee(user.id);
                }}
              >
                <Flex align="center" gap={8} style={{ minWidth: 0 }}>
                  <UserIcon size={15} />
                  <Text size="small" ellipsis>
                    {user.name}
                  </Text>
                </Flex>
                <ReferenceTypeBadge>{t("Member")}</ReferenceTypeBadge>
              </SearchResultItem>
            ))}
          </SearchResultsList>
        ) : null}
      </Flex>

      <Input
        type="textarea"
        label={t("Description")}
        placeholder={t("Add agenda, meeting link, or notes...")}
        value={description}
        onChange={handleDescriptionChange}
        rows={3}
      />

      <Flex column gap={8}>
        <Text as="label" size="small" weight="bold">
          {t("Linked Collections & Documents")}
        </Text>

        {hasSelectedRefs ? (
          <SelectedReferencesList>
            {selectedCollectionIds.map((colId) => {
              const col = collections.get(colId);
              return (
                <SelectedReferenceCard key={`col-${colId}`}>
                  <Flex align="center" gap={8} style={{ minWidth: 0, flex: 1 }}>
                    <CollectionIcon size={16} />
                    <Text size="small" weight="bold" ellipsis>
                      {col?.displayName ?? t("Collection")}
                    </Text>
                    <ReferenceTypeBadge>{t("Collection")}</ReferenceTypeBadge>
                  </Flex>
                  <RemoveRefButton
                    type="button"
                    onClick={() => handleRemoveCollection(colId)}
                    aria-label={t("Remove reference")}
                    title={t("Remove")}
                  >
                    <CloseIcon size={16} />
                  </RemoveRefButton>
                </SelectedReferenceCard>
              );
            })}

            {selectedDocumentIds.map((docId) => {
              const doc = documents.get(docId);
              return (
                <SelectedReferenceCard key={`doc-${docId}`}>
                  <Flex align="center" gap={8} style={{ minWidth: 0, flex: 1 }}>
                    <DocumentIcon size={16} />
                    <Text size="small" weight="bold" ellipsis>
                      {doc?.displayTitle ?? t("Document")}
                    </Text>
                    <ReferenceTypeBadge>{t("Document")}</ReferenceTypeBadge>
                  </Flex>
                  <RemoveRefButton
                    type="button"
                    onClick={() => handleRemoveDocument(docId)}
                    aria-label={t("Remove reference")}
                    title={t("Remove")}
                  >
                    <CloseIcon size={16} />
                  </RemoveRefButton>
                </SelectedReferenceCard>
              );
            })}
          </SelectedReferencesList>
        ) : null}

        <Input
          placeholder={t("Search collections or documents to attach...")}
          value={refSearchQuery}
          onFocus={() => setIsRefSearchFocused(true)}
          onBlur={() => {
            setTimeout(() => setIsRefSearchFocused(false), 180);
          }}
          onChange={(e) => setRefSearchQuery(e.target.value)}
          margin={0}
        />

        {displayedSuggestions.length > 0 ? (
          <SearchResultsList>
            {displayedSuggestions.map((item) => {
              if (item.kind === "collection") {
                return (
                  <SearchResultItem
                    key={`col-${item.collection.id}`}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleAddCollection(item.collection.id);
                    }}
                  >
                    <Flex align="center" gap={8} style={{ minWidth: 0 }}>
                      <CollectionIcon size={15} />
                      <Text size="small" ellipsis>
                        {item.collection.displayName}
                      </Text>
                    </Flex>
                    <ReferenceTypeBadge>{t("Collection")}</ReferenceTypeBadge>
                  </SearchResultItem>
                );
              }

              return (
                <SearchResultItem
                  key={`doc-${item.document.id}`}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleAddDocument(item.document.id);
                  }}
                >
                  <Flex align="center" gap={8} style={{ minWidth: 0 }}>
                    <DocumentIcon size={15} />
                    <Text size="small" ellipsis>
                      {item.document.displayTitle}
                    </Text>
                  </Flex>
                  <ReferenceTypeBadge>{t("Document")}</ReferenceTypeBadge>
                </SearchResultItem>
              );
            })}
          </SearchResultsList>
        ) : null}
      </Flex>

      <Flex column gap={10}>
        <InputSelect
          label={t("Who can edit this event?")}
          value={permissionType}
          options={permissionOptions}
          onChange={handlePermissionChange}
        />

        {permissionType === CalendarEventPermissionType.Group ? (
          groupOptions.length > 0 ? (
            <InputSelect
              label={t("Group")}
              value={groupId}
              options={groupOptions}
              onChange={setGroupId}
            />
          ) : (
            <EmptyGroupNotice>
              <Text size="small" type="secondary">
                {t(
                  "No groups exist in this workspace yet. Create a group in Settings -> Groups first.",
                )}
              </Text>
            </EmptyGroupNotice>
          )
        ) : null}
      </Flex>

      <Footer>
        <Button
          type="button"
          neutral
          onClick={onRequestClose}
          disabled={isSaving}
        >
          {t("Cancel")}
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving
            ? t("Saving…")
            : isEditing
              ? t("Save Changes")
              : t("Create Event")}
        </Button>
      </Footer>
    </Form>
  );
});

/**
 * Modal form for creating and editing calendar events.
 *
 * @param props Component properties.
 * @returns The rendered modal component.
 */
function CalendarEventModal({
  isOpen,
  event,
  initialDate,
  onRequestClose,
}: Props) {
  const { t } = useTranslation();
  const isEditing = Boolean(event);
  const formKey = `${event?.id ?? "new"}-${initialDate?.toISOString() ?? ""}`;

  return (
    <Modal
      isOpen={isOpen}
      title={isEditing ? t("Edit Event") : t("New Event")}
      onRequestClose={onRequestClose}
      width="480px"
      height="760px"
    >
      {isOpen ? (
        <CalendarEventForm
          key={formKey}
          event={event}
          initialDate={initialDate}
          onRequestClose={onRequestClose}
        />
      ) : null}
    </Modal>
  );
}

export default observer(CalendarEventModal);
