const bcrypt = require('bcryptjs');

module.exports = {
    async up(queryInterface, Sequelize) {
        // Insert admin user only if it doesn't exist; if exists, ensure name is set
        const [rows] = await queryInterface.sequelize.query("SELECT id, name FROM `Users` WHERE username='admin' LIMIT 1");
        if (rows && rows.length > 0) {
            // Backfill name if missing
            if (!rows[0].name) {
                await queryInterface.sequelize.query("UPDATE `Users` SET name='Administrator', updatedAt=NOW() WHERE id=" + rows[0].id)
            }
            return;
        }
        const passwordHash = await bcrypt.hash('password', 10);
        return queryInterface.bulkInsert('Users', [{
            name: 'Administrator',
            username: 'admin',
            password: passwordHash,
            createdAt: new Date(),
            updatedAt: new Date()
        }], {});
    },

    async down(queryInterface, Sequelize) {
        return queryInterface.bulkDelete('Users', { username: 'admin' }, {});
    }
};
