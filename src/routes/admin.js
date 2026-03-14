import express from 'express';
import multer from 'multer';

import {
    getUsers, createUser, deleteUser, updateUser,
    getPredefinedData, createPredefinedData, updatePredefinedData, deletePredefinedData,
    uploadExcelData, uploadPredefinedExcel, getStats, downloadTemplate, getSlipDataView,
    deleteSlipDataByRange, getPrintReports, exportPrintReports
} from '../controllers/adminController.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Middleware to verify Admin role
const authenticateAdmin = (req, res, next) => {
    // Add JWT verification here in production
    next();
};

// --- Stats ---
router.get('/stats', authenticateAdmin, getStats);

// --- Reporting ---
router.get('/reports', authenticateAdmin, getPrintReports);
router.get('/reports/export', authenticateAdmin, exportPrintReports);

// --- Template Download ---
router.get('/template', authenticateAdmin, downloadTemplate);

// --- Slip Data View (admin + incharge) ---
router.get('/slip-data', getSlipDataView);
router.delete('/slip-data/range', authenticateAdmin, deleteSlipDataByRange);

// --- User Management ---
router.get('/users', authenticateAdmin, getUsers);
router.post('/users', authenticateAdmin, createUser);
router.put('/users/:id', authenticateAdmin, updateUser);
router.delete('/users/:id', authenticateAdmin, deleteUser);

// --- Predefined Data Management ---
router.get('/predefined', authenticateAdmin, getPredefinedData);
router.post('/predefined', authenticateAdmin, createPredefinedData);
router.put('/predefined/:id', authenticateAdmin, updatePredefinedData);
router.delete('/predefined/:id', authenticateAdmin, deletePredefinedData);

// --- Excel Upload for Slip Data ---
router.post('/upload', authenticateAdmin, upload.single('file'), uploadExcelData);

// --- Excel Upload for Predefined Data (DEV ONLY) ---
router.post('/predefined/upload', authenticateAdmin, upload.single('file'), uploadPredefinedExcel);

export default router;
