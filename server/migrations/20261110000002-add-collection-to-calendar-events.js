"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.sequelize.transaction(async (transaction) => {
      const tableInfo = await queryInterface.describeTable("calendar_events");

      if (!tableInfo.collectionId) {
        await queryInterface.addColumn(
          "calendar_events",
          "collectionId",
          {
            type: Sequelize.UUID,
            allowNull: true,
            references: {
              model: "collections",
              key: "id",
            },
            onDelete: "SET NULL",
          },
          { transaction }
        );

        await queryInterface.addIndex("calendar_events", ["collectionId"], {
          transaction,
        });
      }
    });
  },

  async down(queryInterface) {
    return queryInterface.sequelize.transaction(async (transaction) => {
      const tableInfo = await queryInterface.describeTable("calendar_events");

      if (tableInfo.collectionId) {
        await queryInterface.removeColumn("calendar_events", "collectionId", {
          transaction,
        });
      }
    });
  },
};
