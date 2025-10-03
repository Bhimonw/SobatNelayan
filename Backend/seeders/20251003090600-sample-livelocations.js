'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const alatIds = ['alat1', 'alat2', 'alat3', 'alat4', 'alat5'];
        const base = { lat: -6.2, lon: 106.8 };
        const now = new Date();
        const start = new Date(now);
        start.setMonth(now.getMonth() - 5); // include current and previous 5 months
        start.setDate(1); start.setHours(0, 0, 0, 0);

        const rows = [];
        for (let d = new Date(start); d <= now; d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
            for (const alatId of alatIds) {
                // create between 2..6 events per day
                const events = 2 + Math.floor(Math.random() * 5);
                for (let i = 0; i < events; i++) {
                    const ts = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60));
                    const status = Math.random() < 0.7 ? 'on' : 'off';
                    const lat = base.lat + (Math.random() - 0.5) * 0.1; // ~11km jitter
                    const lon = base.lon + (Math.random() - 0.5) * 0.1;
                    rows.push({
                        alatId,
                        latitude: lat,
                        longitude: lon,
                        status,
                        timestamp: ts,
                        createdAt: ts,
                        updatedAt: ts,
                    });
                }
            }
        }

        // chunk insert to avoid oversized payloads
        const chunk = 2000;
        for (let i = 0; i < rows.length; i += chunk) {
            await queryInterface.bulkInsert('Livelocations', rows.slice(i, i + chunk));
        }
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.bulkDelete('Livelocations', null, {});
    }
};
