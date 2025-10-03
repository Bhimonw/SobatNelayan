'use strict';
const bcrypt = require('bcryptjs');

module.exports = {
    async up(queryInterface, Sequelize) {
        // Hapus semua user lalu buat satu admin (robust delete)
        await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
        await queryInterface.bulkDelete('Users', null, { truncate: false, cascade: true });
        // Reset auto increment (optional)
        try { await queryInterface.sequelize.query('ALTER TABLE `Users` AUTO_INCREMENT = 1'); } catch (e) { }
        await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
        const passwordHash = await bcrypt.hash('password', 10);
        await queryInterface.bulkInsert('Users', [
            {
                name: 'Administrator',
                username: 'admin',
                password: passwordHash,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ]);
    },

    async down(queryInterface, Sequelize) {
        // Menghapus user admin yang dibuat oleh seeder ini
        await queryInterface.bulkDelete('Users', { username: 'admin' }, {});
    },
};
