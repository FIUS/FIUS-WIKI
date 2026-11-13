"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "calendar_events",
        {
          id: {
            type: Sequelize.UUID,
            allowNull: false,
            defaultValue: Sequelize.UUIDV4,
            primaryKey: true,
          },
          teamId: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: "teams",
              key: "id",
            },
            onDelete: "CASCADE",
          },
          title: {
            type: Sequelize.STRING(255),
            allowNull: false,
          },
          description: {
            type: Sequelize.TEXT,
            allowNull: true,
          },
          startAt: {
            type: Sequelize.DATE,
            allowNull: false,
          },
          endAt: {
            type: Sequelize.DATE,
            allowNull: false,
          },
          allDay: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
          },
          color: {
            type: Sequelize.STRING(32),
            allowNull: true,
          },
          documentId: {
            type: Sequelize.UUID,
            allowNull: true,
            references: {
              model: "documents",
              key: "id",
            },
            onDelete: "SET NULL",
          },
          permissionType: {
            type: Sequelize.STRING(32),
            allowNull: false,
            defaultValue: "creator_or_admin",
          },
          groupId: {
            type: Sequelize.UUID,
            allowNull: true,
            references: {
              model: "groups",
              key: "id",
            },
            onDelete: "SET NULL",
          },
          createdById: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: "users",
              key: "id",
            },
            onDelete: "CASCADE",
          },
          updatedById: {
            type: Sequelize.UUID,
            allowNull: true,
            references: {
              model: "users",
              key: "id",
            },
            onDelete: "SET NULL",
          },
          createdAt: {
            type: Sequelize.DATE,
            allowNull: false,
          },
          updatedAt: {
            type: Sequelize.DATE,
            allowNull: false,
          },
          deletedAt: {
            type: Sequelize.DATE,
            allowNull: true,
          },
        },
        { transaction }
      );

      await queryInterface.addIndex("calendar_events", ["teamId", "startAt"], {
        transaction,
      });

      await queryInterface.addIndex("calendar_events", ["teamId", "endAt"], {
        transaction,
      });

      await queryInterface.addIndex("calendar_events", ["documentId"], {
        transaction,
      });

      await queryInterface.addIndex("calendar_events", ["groupId"], {
        transaction,
      });
    });
  },

  async down(queryInterface) {
    return queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("calendar_events", { transaction });
    });
  },
};
