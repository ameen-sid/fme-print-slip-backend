import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase } from './database/initializeDatabase.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import inchargeRoutes from './routes/incharge.js';
import operatorRoutes from './routes/operator.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.get('/api/test', (req, res) => res.json({ message: 'Backend is reachable!' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/incharge', inchargeRoutes);
app.use('/api/operator', operatorRoutes);

// Database Initialization & Server Start
initializeDatabase().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on all interfaces at port ${PORT}`);
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
});
