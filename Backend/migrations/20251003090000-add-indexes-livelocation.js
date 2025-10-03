'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Composite index to speed up monthly recap (status ON within time range grouped by alatId)
        await queryInterface.addIndex('Livelocations', ['status', 'timestamp', 'alatId'], {
            name: 'idx_livelocations_status_ts_alatid'
        });
        // Composite index to speed up latest location per alat (ordering by timestamp desc)
        await queryInterface.addIndex('Livelocations', ['alatId', 'timestamp'], {
            name: 'idx_livelocations_alatid_ts'
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeIndex('Livelocations', 'idx_livelocations_status_ts_alatid');
        await queryInterface.removeIndex('Livelocations', 'idx_livelocations_alatid_ts');
    }
};
