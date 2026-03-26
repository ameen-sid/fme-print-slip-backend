import express from 'express';
import jwt from 'jsonwebtoken';
import { getRequests, approvePrintRequest, rejectPrintRequest } from '../controllers/inchargeController.js';
import { getPrintReports, exportPrintReports } from '../controllers/adminController.js';

const router = express.Router();

// JWT middleware — require incharge role
const authenticateIncharge = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'incharge') {
            return res.status(403).json({ message: 'Access denied. Incharge only.' });
        }
        req.user = decoded;
        next();
    } catch {
        res.status(401).json({ message: 'Invalid or expired token' });
    }
};

// GET  /api/incharge/requests?status=all|pending|approved|rejected
router.get('/requests', authenticateIncharge, getRequests);

// POST /api/incharge/requests/:id/approve
router.post('/requests/:id/approve', authenticateIncharge, approvePrintRequest);

// POST /api/incharge/requests/:id/reject
router.post('/requests/:id/reject', authenticateIncharge, rejectPrintRequest);

// GET /api/incharge/reports
router.get('/reports', authenticateIncharge, getPrintReports);
router.get('/reports/export', authenticateIncharge, exportPrintReports);

export default router;
