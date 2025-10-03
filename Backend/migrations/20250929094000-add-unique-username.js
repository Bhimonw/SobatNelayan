'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Remove duplicate usernames keeping the lowest id
        try {
            await queryInterface.sequelize.query(
                'DELETE u1 FROM `Users` u1 INNER JOIN `Users` u2 ON u1.username = u2.username AND u1.id > u2.id'
            )
        } catch (e) { /* ignore if table empty */ }
        await queryInterface.addConstraint('Users', {
            fields: ['username'],
            type: 'unique',
            name: 'users_username_unique'
        })
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeConstraint('Users', 'users_username_unique')
    }
}
