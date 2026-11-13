"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    return queryInterface.sequelize.transaction(async (transaction) => {
      const tableInfo = await queryInterface.describeTable("calendar_events");

      if (!tableInfo.collectionIds) {
        await queryInterface.addColumn(
          "calendar_events",
          "collectionIds",
          {
            type: Sequelize.ARRAY(Sequelize.UUID),
            allowNull: false,
            defaultValue: [],
          },
          { transaction }
        );
      }

      if (!tableInfo.documentIds) {
        await queryInterface.addColumn(
          "calendar_events",
          "documentIds",
          {
            type: Sequelize.ARRAY(Sequelize.UUID),
            allowNull: false,
            defaultValue: [],
          },
          { transaction }
        );
      }

      await queryInterface.sequelize.query(
        `UPDATE "calendar_events" SET "documentIds" = ARRAY["documentId"] WHERE "documentId" IS NOT NULL AND (cardinality("documentIds") IS NULL OR cardinality("documentIds") = 0)`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `UPDATE "calendar_events" SET "collectionIds" = ARRAY["collectionId"] WHERE "collectionId" IS NOT NULL AND (cardinality("collectionIds") IS NULL OR cardinality("collectionIds") = 0)`,
        { transaction }
      );
    });
  },

  async down(queryInterface) {
    return queryInterface.sequelize.transaction(async (transaction) => {
      const tableInfo = await queryInterface.describeTable("calendar_events");

      if (tableInfo.documentIds) {
        await queryInterface.removeColumn("calendar_events", "documentIds", {
          transaction,
        });
      }

      if (tableInfo.collectionIds) {
        await queryInterface.removeColumn("calendar_events", "collectionIds", {
          transaction,
        });
      }
    });
  },
};
