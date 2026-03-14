import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sql, poolPromise } from '../database/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_change_in_production';

export const loginUser = async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    try {
        const pool = await poolPromise;

        // MSSQL Parameterized Query
        const result = await pool.request()
            .input('username', sql.VarChar, username)
            .query('SELECT * FROM users WHERE username = @username');

        const users = result.recordset;

        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
            JWT_SECRET,
            { expiresIn: '12h' }
        );

        res.json({ token, user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role } });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'An error occurred during login' });
    }
};




// import bcrypt from 'bcryptjs';
// import jwt from 'jsonwebtoken';
// import pool from '../database/db.js';

// const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_change_in_production';

// export const loginUser = async (req, res) => {
//     const { username, password } = req.body;
//     if (!username || !password) {
//         return res.status(400).json({ message: 'Username and password are required' });
//     }

//     try {
//         const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
//         if (users.length === 0) {
//             return res.status(401).json({ message: 'Invalid credentials' });
//         }

//         const user = users[0];
//         const isMatch = await bcrypt.compare(password, user.password_hash);
//         if (!isMatch) {
//             return res.status(401).json({ message: 'Invalid credentials' });
//         }

//         const token = jwt.sign(
//             { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
//             JWT_SECRET,
//             { expiresIn: '12h' }
//         );

//         res.json({ token, user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role } });
//     } catch (error) {
//         console.error('Login error:', error);
//         res.status(500).json({ message: 'An error occurred during login' });
//     }
// };
