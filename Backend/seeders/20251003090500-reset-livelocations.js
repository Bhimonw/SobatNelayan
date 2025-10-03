'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.bulkDelete('Livelocations', null, { truncate: true, cascade: true, restartIdentity: true });
    },

    async down(queryInterface, Sequelize) {
        // no-op
    }
};
