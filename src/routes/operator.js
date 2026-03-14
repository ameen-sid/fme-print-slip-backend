import express from 'express';
import jwt from 'jsonwebtoken';
import { getSlip, printSlip, requestReprint } from '../controllers/operatorController.js';

const router = express.Router();

// Middleware — verify JWT and require 'operator' role
const authenticateOperator = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'operator') {
            return res.status(403).json({ message: 'Access denied. Operators only.' });
        }
        req.user = decoded;
        next();
    } catch {
        res.status(401).json({ message: 'Invalid or expired token' });
    }
};

// GET /api/operator/slip?slip_no=&kanban_no=
router.get('/slip', authenticateOperator, getSlip);

// POST /api/operator/print
router.post('/print', authenticateOperator, printSlip);

// POST /api/operator/request-reprint
router.post('/request-reprint', authenticateOperator, requestReprint);

export default router;
