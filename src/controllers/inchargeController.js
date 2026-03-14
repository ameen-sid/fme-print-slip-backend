import { sql, poolPromise } from '../database/db.js';

// GET /api/incharge/requests?status=all|pending|approved|rejected&search=term
export const getRequests = async (req, res) => {
    try {
        const { status, search } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const pool = await poolPromise;
        const request = pool.request(); // Create a request object to build dynamic inputs

        const conditions = [];

        if (status && status !== 'all') {
            conditions.push('pr.status = @status');
            request.input('status', sql.VarChar, status);
        }

        if (search && search.trim()) {
            conditions.push('(pr.slip_no LIKE @search OR pr.operator_username LIKE @search OR sd.kanban_no LIKE @search OR sd.item_name LIKE @search)');
            request.input('search', sql.VarChar, `%${search.trim()}%`);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        // 1. Get Total Count (using the same request object so inputs apply)
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM print_requests pr 
            LEFT JOIN slip_data sd ON pr.slip_no = sd.slip_no AND pr.kanban_no = sd.kanban_no 
            ${where}
        `;
        const countResult = await request.query(countQuery);
        const total = countResult.recordset[0].total;

        // 2. Add pagination inputs and get the data
        request.input('limit', sql.Int, limit);
        request.input('offset', sql.Int, offset);

        const mainQuery = `
            SELECT
                pr.id,
                pr.slip_no,
                pr.kanban_no,
                pr.operator_username,
                pr.status,
                pr.created_at,
                sd.kanban_no as sd_kanban_no,
                sd.item_name,
                sd.to_location
            FROM print_requests pr
            LEFT JOIN slip_data sd ON pr.slip_no = sd.slip_no AND pr.kanban_no = sd.kanban_no
            ${where}
            ORDER BY pr.created_at DESC
            OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `;
        const requestsResult = await request.query(mainQuery);

        // 3. Fetch total counts for all statuses independently of limits/pages
        const countsResult = await pool.request().query('SELECT status, COUNT(*) as count FROM print_requests GROUP BY status');

        const statusCounts = { pending: 0, approved: 0, rejected: 0 };
        countsResult.recordset.forEach(row => {
            statusCounts[row.status] = row.count;
        });

        res.json({
            data: requestsResult.recordset,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            statusCounts
        });
    } catch (error) {
        console.error('getRequests error:', error);
        res.status(500).json({ error: error.message });
    }
};

// POST /api/incharge/requests/:id/approve
export const approvePrintRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await poolPromise;

        // Note: MSSQL prefers single quotes for strings ('approved' instead of "approved")
        await pool.request()
            .input('id', sql.Int, id)
            .query("UPDATE print_requests SET status = 'approved' WHERE id = @id");

        // Unlock the slip so operator can print once more 
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT slip_no, kanban_no FROM print_requests WHERE id = @id');

        if (result.recordset.length > 0) {
            const row = result.recordset[0];
            await pool.request()
                .input('slip_no', sql.VarChar, row.slip_no)
                .input('kanban_no', sql.VarChar, row.kanban_no)
                .query('UPDATE slip_data SET is_locked = 0 WHERE slip_no = @slip_no AND kanban_no = @kanban_no');
        }

        res.json({ message: 'Request approved successfully.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// POST /api/incharge/requests/:id/reject
export const rejectPrintRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await poolPromise;

        await pool.request()
            .input('id', sql.Int, id)
            .query("UPDATE print_requests SET status = 'rejected' WHERE id = @id");

        res.json({ message: 'Request rejected.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Kept for backward-compat — alias to getRequests with pending filter
export const getPendingRequests = async (req, res) => {
    req.query.status = 'pending';
    return getRequests(req, res);
};




// import pool from '../database/db.js';

// // GET /api/incharge/requests?status=all|pending|approved|rejected&search=term
// export const getRequests = async (req, res) => {
//     try {
//         const { status, search } = req.query;
//         const page = parseInt(req.query.page) || 1;
//         const limit = parseInt(req.query.limit) || 10;
//         const offset = (page - 1) * limit;

//         const conditions = [];
//         const params = [];

//         if (status && status !== 'all') {
//             conditions.push('pr.status = ?');
//             params.push(status);
//         }

//         if (search && search.trim()) {
//             const like = `%${search.trim()}%`;
//             conditions.push('(pr.slip_no LIKE ? OR pr.operator_username LIKE ? OR sd.kanban_no LIKE ? OR sd.item_name LIKE ?)');
//             params.push(like, like, like, like);
//         }

//         const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

//         const [[{ total }]] = await pool.query(
//             `SELECT COUNT(*) as total FROM print_requests pr LEFT JOIN slip_data sd ON pr.slip_no = sd.slip_no ${where}`,
//             params
//         );

//         params.push(limit, offset);

//         const [requests] = await pool.query(
//             `SELECT
//                 pr.id,
//                 pr.slip_no,
//                 pr.kanban_no,
//                 pr.operator_username,
//                 pr.status,
//                 pr.created_at,
//                 sd.kanban_no as sd_kanban_no,
//                 sd.item_name,
//                 sd.to_location
//              FROM print_requests pr
//              LEFT JOIN slip_data sd ON pr.slip_no = sd.slip_no AND pr.kanban_no = sd.kanban_no
//              ${where}
//              ORDER BY pr.created_at DESC
//              LIMIT ? OFFSET ?`,
//             params
//         );

//         // Fetch total counts for all statuses independently of limits/pages, but respecting the search filter if we want (or keeping it completely raw).
//         // We will keep it raw to display total system requests in badges.
//         const [counts] = await pool.query('SELECT status, COUNT(*) as count FROM print_requests GROUP BY status');
//         const statusCounts = { pending: 0, approved: 0, rejected: 0 };
//         counts.forEach(row => {
//             statusCounts[row.status] = row.count;
//         });

//         res.json({
//             data: requests,
//             total,
//             page,
//             limit,
//             totalPages: Math.ceil(total / limit),
//             statusCounts
//         });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };

// // POST /api/incharge/requests/:id/approve
// export const approvePrintRequest = async (req, res) => {
//     try {
//         const { id } = req.params;

//         await pool.query('UPDATE print_requests SET status = "approved" WHERE id = ?', [id]);

//         // Unlock the slip so operator can print once more (is_locked tracks the gate,
//         // print_count is the cumulative total and is NEVER reset)
//         const [rows] = await pool.query('SELECT slip_no, kanban_no FROM print_requests WHERE id = ?', [id]);
//         if (rows.length > 0) {
//             await pool.query('UPDATE slip_data SET is_locked = 0 WHERE slip_no = ? AND kanban_no = ?', [rows[0].slip_no, rows[0].kanban_no]);
//         }

//         res.json({ message: 'Request approved successfully.' });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };

// // POST /api/incharge/requests/:id/reject
// export const rejectPrintRequest = async (req, res) => {
//     try {
//         const { id } = req.params;
//         await pool.query('UPDATE print_requests SET status = "rejected" WHERE id = ?', [id]);
//         res.json({ message: 'Request rejected.' });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };

// // Kept for backward-compat — alias to getRequests with pending filter
// export const getPendingRequests = async (req, res) => {
//     req.query.status = 'pending';
//     return getRequests(req, res);
// };
