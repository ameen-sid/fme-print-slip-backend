import bcrypt from 'bcryptjs';
import { sql, poolPromise } from './db.js';

async function seedAdmin() {
    try {
        const pool = await poolPromise;
        const username = 'admin123';
        const rawPassword = 'admin123';
        const fullName = 'System Administrator';
        const role = 'admin';

        // Check if user already exists using parameterized input
        const existing = await pool.request()
            .input('username', sql.VarChar, username)
            .query('SELECT * FROM users WHERE username = @username');

        // mssql returns rows inside the 'recordset' array
        if (existing.recordset.length > 0) {
            console.log(`User '${username}' already exists. No action taken.`);
            process.exit(0);
        }

        // Hash password and insert
        const passwordHash = await bcrypt.hash(rawPassword, 10);
        await pool.request()
            .input('username', sql.VarChar, username)
            .input('fullName', sql.VarChar, fullName)
            .input('passwordHash', sql.VarChar, passwordHash)
            .input('role', sql.VarChar, role)
            .query('INSERT INTO users (username, full_name, password_hash, role) VALUES (@username, @fullName, @passwordHash, @role)');

        console.log(`Successfully seeded admin user: '${username}'`);
        process.exit(0);
    } catch (error) {
        console.error('Error seeding admin user:', error);
        process.exit(1);
    }
}

seedAdmin();



// import bcrypt from 'bcryptjs';
// import pool from './db.js';

// async function seedAdmin() {
//     try {
//         const username = 'admin123';
//         const rawPassword = 'admin123';
//         const fullName = 'System Administrator';
//         const role = 'admin';

//         // Check if user already exists
//         const [existing] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
//         if (existing.length > 0) {
//             console.log(`User '${username}' already exists. No action taken.`);
//             process.exit(0);
//         }

//         // Hash password and insert
//         const passwordHash = await bcrypt.hash(rawPassword, 10);
//         await pool.query(
//             'INSERT INTO users (username, full_name, password_hash, role) VALUES (?, ?, ?, ?)',
//             [username, fullName, passwordHash, role]
//         );

//         console.log(`Successfully seeded admin user: '${username}'`);
//         process.exit(0);
//     } catch (error) {
//         console.error('Error seeding admin user:', error);
//         process.exit(1);
//     }
// }

// seedAdmin();
