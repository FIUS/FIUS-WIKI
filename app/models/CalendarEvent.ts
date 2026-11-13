import { computed, observable } from "mobx";
import type {
  CalendarEventPermissionType,
  CalendarEventRecurrenceFrequency,
} from "@shared/types";
import type CalendarEventsStore from "~/stores/CalendarEventsStore";
import Collection from "./Collection";
import Document from "./Document";
import Group from "./Group";
import User from "./User";
import Model from "./base/Model";
import Field from "./decorators/Field";
import Relation from "./decorators/Relation";

export default class CalendarEvent extends Model {
  public static modelName = "CalendarEvent";

  constructor(fields: Record<string, unknown>, store: CalendarEventsStore) {
    super(fields, store);
    this.initialize(fields);
  }

  public store: CalendarEventsStore;

  @Field
  @observable
  public title: string;

  @Field
  @observable
  public description: string | null;

  @Field
  @observable
  public startAt: string;

  @Field
  @observable
  public endAt: string;

  @Field
  @observable
  public allDay: boolean;

  @Field
  @observable
  public color: string | null;

  @Field
  @observable
  public recurrenceFrequency: CalendarEventRecurrenceFrequency | null;

  @Field
  @observable
  public recurrenceEndAt: string | null;

  @Field
  @observable
  public tags: string[] = [];

  @Field
  @observable
  public assigneeIds: string[] = [];

  @Relation(() => User, { multiple: true, onDelete: "ignore" })
  public assignees: User[];

  @Field
  @observable
  public collectionId: string | null;

  @Field
  @observable
  public collectionIds: string[] = [];

  @Relation(() => Collection, { onDelete: "null" })
  public collection?: Collection;

  @Relation(() => Collection, { multiple: true, onDelete: "ignore" })
  public collections: Collection[];

  @Field
  @observable
  public documentId: string | null;

  @Field
  @observable
  public documentIds: string[] = [];

  @Relation(() => Document, { onDelete: "null" })
  public document?: Document;

  @Relation(() => Document, { multiple: true, onDelete: "ignore" })
  public documents: Document[];

  /**
   * Returns all referenced collection IDs, falling back to singular collectionId.
   */
  @computed
  public get resolvedCollectionIds(): string[] {
    if (this.collectionIds && this.collectionIds.length > 0) {
      return this.collectionIds;
    }
    return this.collectionId ? [this.collectionId] : [];
  }

  /**
   * Returns all referenced document IDs, falling back to singular documentId.
   */
  @computed
  public get resolvedDocumentIds(): string[] {
    if (this.documentIds && this.documentIds.length > 0) {
      return this.documentIds;
    }
    return this.documentId ? [this.documentId] : [];
  }

  @Field
  @observable
  public permissionType: CalendarEventPermissionType;

  @Field
  @observable
  public groupId: string | null;

  @Relation(() => Group, { onDelete: "null" })
  public group?: Group;

  @observable
  public createdById: string;

  @Relation(() => User, { onDelete: "cascade" })
  public createdBy: User;

  @observable
  public updatedById: string | null;

  @Relation(() => User, { onDelete: "null" })
  public updatedBy?: User;
}
