'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('Users', 'name', {
            type: Sequelize.STRING,
            allowNull: true,
            defaultValue: null,
            after: 'id'
        })
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('Users', 'name')
    }
};
