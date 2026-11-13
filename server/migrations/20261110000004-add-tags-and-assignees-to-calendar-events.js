"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.sequelize.transaction(async (transaction) => {
      const tableInfo = await queryInterface.describeTable("calendar_events");

      if (!tableInfo.tags) {
        await queryInterface.addColumn(
          "calendar_events",
          "tags",
          {
            type: Sequelize.ARRAY(Sequelize.STRING(64)),
            allowNull: false,
            defaultValue: [],
          },
          { transaction }
        );
      }

      if (!tableInfo.assigneeIds) {
        await queryInterface.addColumn(
          "calendar_events",
          "assigneeIds",
          {
            type: Sequelize.ARRAY(Sequelize.UUID),
            allowNull: false,
            defaultValue: [],
          },
          { transaction }
        );
      }
    });
  },

  async down(queryInterface) {
    return queryInterface.sequelize.transaction(async (transaction) => {
      const tableInfo = await queryInterface.describeTable("calendar_events");

      if (tableInfo.assigneeIds) {
        await queryInterface.removeColumn("calendar_events", "assigneeIds", {
          transaction,
        });
      }

      if (tableInfo.tags) {
        await queryInterface.removeColumn("calendar_events", "tags", {
          transaction,
        });
      }
    });
  },
};
