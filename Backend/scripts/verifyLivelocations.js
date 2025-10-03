const db = require('../models');
(async () => {
    try {
        const count = await db.Livelocation.count();
        const minRow = await db.Livelocation.findOne({ order: [['timestamp', 'ASC']] });
        const maxRow = await db.Livelocation.findOne({ order: [['timestamp', 'DESC']] });
        console.log(JSON.stringify({ count, min: minRow?.timestamp, max: maxRow?.timestamp }, null, 2));
    } catch (e) {
        console.error(e);
        process.exit(1);
    } finally {
        await db.sequelize.close();
    }
})();
