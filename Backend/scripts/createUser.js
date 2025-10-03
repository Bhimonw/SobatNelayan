const db = require('../models');
const bcrypt = require('bcryptjs');

async function createUser() {
    const username = 'admin'; // ganti sesuai kebutuhan
    const password = 'password123'; // ganti sesuai kebutuhan
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
        const user = await db.User.create({ username, password: hashedPassword });
        console.log('User created:', user.username);
    } catch (err) {
        console.error('Error creating user:', err);
    }
}

createUser();
