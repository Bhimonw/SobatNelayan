const db = require('../models');
const bcrypt = require('bcryptjs');

async function reset() {
  try {
    // remove all livelocations
    console.log('Truncating Livelocations...');
    await db.Livelocation.destroy({ where: {}, truncate: true });

    // remove all users except admin
    console.log('Deleting non-admin users...');
    await db.User.destroy({ where: { username: { [db.Sequelize.Op.ne]: 'admin' } } });

    // ensure admin exists
    const admin = await db.User.findOne({ where: { username: 'admin' } });
    if (!admin) {
      console.log('Admin user missing — creating with default password "password"');
      const hashed = await bcrypt.hash('password', 10);
      await db.User.create({ name: 'Administrator', username: 'admin', password: hashed });
    } else {
      console.log('Admin user exists, leaving it intact.');
    }

    console.log('Reset complete.');
    process.exit(0);
  } catch (err) {
    console.error('Reset failed:', err);
    process.exit(1);
  }
}

reset();
