import type {
  InferAttributes,
  InferCreationAttributes,
} from "sequelize";
import {
  DataType,
  Column,
  ForeignKey,
  BelongsTo,
  Table,
  Length,
  DefaultScope,
  Scopes,
  Default,
} from "sequelize-typescript";
import {
  CalendarEventPermissionType,
  type CalendarEventRecurrenceFrequency,
} from "@shared/types";
import { CalendarEventValidation } from "@shared/validations";
import Collection from "./Collection";
import Document from "./Document";
import Group from "./Group";
import Team from "./Team";
import User from "./User";
import ParanoidModel from "./base/ParanoidModel";

/**
 * Represents a calendar event scheduled within a workspace team.
 */
@DefaultScope(() => ({
  include: [
    {
      association: "createdBy",
      paranoid: false,
    },
    {
      association: "group",
      paranoid: false,
      include: [
        {
          association: "groupUsers",
          required: false,
        },
      ],
    },
  ],
}))
@Scopes(() => ({
  withDocument: {
    include: [
      {
        association: "document",
      },
    ],
  },
}))
@Table({ tableName: "calendar_events", modelName: "calendar_event" })
export default class CalendarEvent extends ParanoidModel<
  InferAttributes<CalendarEvent>,
  Partial<InferCreationAttributes<CalendarEvent>>
> {
  // Public static variables

  public static readonly modelName = "calendar_event";

  public static readonly eventNamespace = "calendarEvents";

  // Public variables

  @Length({
    max: CalendarEventValidation.maxTitleLength,
    msg: `Title must be ${CalendarEventValidation.maxTitleLength} characters or less`,
  })
  @Column(DataType.STRING(255))
  public title: string;

  @Length({
    max: CalendarEventValidation.maxDescriptionLength,
    msg: `Description must be ${CalendarEventValidation.maxDescriptionLength} characters or less`,
  })
  @Column(DataType.TEXT)
  public description: string | null;

  @Column(DataType.DATE)
  public startAt: Date;

  @Column(DataType.DATE)
  public endAt: Date;

  @Default(false)
  @Column(DataType.BOOLEAN)
  public allDay: boolean;

  @Column(DataType.STRING(32))
  public color: string | null;

  @Column(DataType.STRING(32))
  public recurrenceFrequency: CalendarEventRecurrenceFrequency | null;

  @Column(DataType.DATE)
  public recurrenceEndAt: Date | null;

  @Default([])
  @Column(DataType.ARRAY(DataType.STRING(64)))
  public tags: string[];

  @Default([])
  @Column(DataType.ARRAY(DataType.UUID))
  public assigneeIds: string[];

  @Default([])
  @Column(DataType.ARRAY(DataType.UUID))
  public collectionIds: string[];

  @Default([])
  @Column(DataType.ARRAY(DataType.UUID))
  public documentIds: string[];

  @Default(CalendarEventPermissionType.CreatorOrAdmin)
  @Column(DataType.STRING(32))
  public permissionType: CalendarEventPermissionType;

  // Associations

  @BelongsTo(() => Team, "teamId")
  public team: Team;

  @ForeignKey(() => Team)
  @Column(DataType.UUID)
  public teamId: string;

  @BelongsTo(() => User, "createdById")
  public createdBy: User;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  public createdById: string;

  @BelongsTo(() => User, "updatedById")
  public updatedBy: User | null;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  public updatedById: string | null;

  @BelongsTo(() => Collection, "collectionId")
  public collection: Collection | null;

  @ForeignKey(() => Collection)
  @Column(DataType.UUID)
  public collectionId: string | null;

  @BelongsTo(() => Document, "documentId")
  public document: Document | null;

  @ForeignKey(() => Document)
  @Column(DataType.UUID)
  public documentId: string | null;

  @BelongsTo(() => Group, "groupId")
  public group: Group | null;

  @ForeignKey(() => Group)
  @Column(DataType.UUID)
  public groupId: string | null;
}
