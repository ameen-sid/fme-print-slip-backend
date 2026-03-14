import { sql, poolPromise } from '../database/db.js';

// ── QR String Generation ──────────────────────────────────────────────────────
const WIRE_GROUPS = ['10043'];
const TERMINAL_GROUPS = ['10009', '10011', '10038'];
const SEAL_GROUPS = ['10053'];

const buildQrString = (materialGroup, predefined, kanban_no) => {
    const mg = String(materialGroup || '').trim();

    if (WIRE_GROUPS.includes(mg)) {
        // Wire: wire_type_name-wire_size-wire_colour-part_code-kanban_no+
        const t = predefined?.wire_type_name || '';
        const s = predefined?.wire_size || '';
        const c = predefined?.wire_colour || '';
        const p = predefined?.part_code || '';
        return `${t}-${s}-${c}-${p}-${kanban_no}+`;
    }

    if (TERMINAL_GROUPS.includes(mg) || SEAL_GROUPS.includes(mg)) {
        // Terminal / Seal: wire_type_name**kanban_no
        const t = predefined?.wire_type_name || '';
        return `${t}**${kanban_no}`;
    }

    // Fallback — unknown group: no QR
    return null;
};

// ── GET /api/operator/slip?slip_no=&kanban_no= ────────────────────────────────
export const getSlip = async (req, res) => {
    const { slip_no, kanban_no } = req.query;

    if (!slip_no || !kanban_no) {
        return res.status(400).json({ message: 'slip_no and kanban_no are required.' });
    }

    try {
        const pool = await poolPromise;

        // Fetch slip data
        const slipResult = await pool.request()
            .input('slip_no', sql.VarChar, slip_no.trim())
            .input('kanban_no', sql.VarChar, kanban_no.trim())
            .query('SELECT * FROM slip_data WHERE slip_no = @slip_no AND kanban_no = @kanban_no');

        if (slipResult.recordset.length === 0) {
            return res.status(404).json({ message: 'Slip not found. Please check Slip No and Kanban No.' });
        }

        const slip = slipResult.recordset[0];

        // Look up predefined_data using item_code as part_code (Using TOP 1 instead of LIMIT 1)
        const predefinedResult = await pool.request()
            .input('part_code', sql.VarChar, slip.item_code)
            .query('SELECT TOP 1 * FROM predefined_data WHERE part_code = @part_code');

        const predefined = predefinedResult.recordset[0] || null;

        const qr_string = buildQrString(predefined?.material_group, predefined, kanban_no.trim());

        res.json({
            slip_no: slip.slip_no,
            kanban_no: slip.kanban_no,
            item_code: slip.item_code,
            item_name: slip.item_name,
            issue_qty: slip.issue_qty,
            material_type: slip.material_type,
            rack_no: slip.rack_no,
            supp_part_no: slip.supp_part_no || predefined?.wire_type_name || slip.item_code,
            qr_string,
        });

    } catch (error) {
        console.error('getSlip error:', error);
        res.status(500).json({ error: error.message });
    }
};

// ── POST /api/operator/print  ─────────────────────────────────────────────────
export const printSlip = async (req, res) => {
    const { slip_no, kanban_no } = req.body;
    const operator_username = req.user?.username || req.body.operator_username || null;

    try {
        const pool = await poolPromise;

        const slipResult = await pool.request()
            .input('slip_no', sql.VarChar, slip_no)
            .input('kanban_no', sql.VarChar, kanban_no)
            .query('SELECT * FROM slip_data WHERE slip_no = @slip_no AND kanban_no = @kanban_no');

        if (slipResult.recordset.length === 0) {
            return res.status(404).json({ message: 'Slip not found.' });
        }

        const slip = slipResult.recordset[0];

        // is_locked = reprint gate (0/null/false = can print, 1/true = locked)
        if (slip.is_locked) {
            return res.status(403).json({ message: 'Slip already printed.', requires_approval: true });
        }

        // Update print count and lock (Using GETDATE() instead of NOW())
        await pool.request()
            .input('operator_username', sql.VarChar, operator_username)
            .input('slip_no', sql.VarChar, slip_no)
            .input('kanban_no', sql.VarChar, kanban_no)
            .query(`
                UPDATE slip_data 
                SET print_count = print_count + 1, 
                    is_locked = 1, 
                    last_printed_by = @operator_username, 
                    last_printed_at = GETDATE() 
                WHERE slip_no = @slip_no AND kanban_no = @kanban_no
            `);

        // ── Log the print event for reporting ──
        await pool.request()
            .input('slip_no', sql.VarChar, slip_no)
            .input('kanban_no', sql.VarChar, kanban_no)
            .input('item_code', sql.VarChar, slip.item_code)
            .input('material_type', sql.VarChar, slip.material_type)
            .input('operator_username', sql.VarChar, operator_username)
            .query(`
                INSERT INTO print_logs (slip_no, kanban_no, item_code, material_type, operator_username) 
                VALUES (@slip_no, @kanban_no, @item_code, @material_type, @operator_username)
            `);

        res.json({ message: 'Print command sent successfully.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ── POST /api/operator/request-reprint ───────────────────────────────────────
export const requestReprint = async (req, res) => {
    const { slip_no, kanban_no, operator_username } = req.body;

    try {
        if (!kanban_no) {
            return res.status(400).json({ message: 'Kanban Number is missing from the reprint request.' });
        }

        const pool = await poolPromise;

        const existingResult = await pool.request()
            .input('slip_no', sql.VarChar, slip_no)
            .input('kanban_no', sql.VarChar, kanban_no)
            .query("SELECT * FROM print_requests WHERE slip_no = @slip_no AND kanban_no = @kanban_no AND status = 'pending'");

        if (existingResult.recordset.length > 0) {
            return res.status(400).json({ message: 'A reprint request is already pending for this slip.' });
        }

        await pool.request()
            .input('slip_no', sql.VarChar, slip_no)
            .input('kanban_no', sql.VarChar, kanban_no)
            .input('operator_username', sql.VarChar, operator_username)
            .query(`
                INSERT INTO print_requests (slip_no, kanban_no, operator_username, status) 
                VALUES (@slip_no, @kanban_no, @operator_username, 'pending')
            `);

        res.json({ message: 'Reprint request sent to Incharge successfully.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};




// import pool from '../database/db.js';

// // ── QR String Generation ──────────────────────────────────────────────────────
// const WIRE_GROUPS = ['10043'];
// const TERMINAL_GROUPS = ['10009', '10011', '10038'];
// const SEAL_GROUPS = ['10053'];

// const buildQrString = (materialGroup, predefined, kanban_no) => {
//     const mg = String(materialGroup || '').trim();

//     if (WIRE_GROUPS.includes(mg)) {
//         // Wire: wire_type_name-wire_size-wire_colour-part_code-kanban_no+
//         const t = predefined?.wire_type_name || '';
//         const s = predefined?.wire_size || '';
//         const c = predefined?.wire_colour || '';
//         const p = predefined?.part_code || '';
//         return `${t}-${s}-${c}-${p}-${kanban_no}+`;
//     }

//     if (TERMINAL_GROUPS.includes(mg) || SEAL_GROUPS.includes(mg)) {
//         // Terminal / Seal: wire_type_name**kanban_no
//         const t = predefined?.wire_type_name || '';
//         return `${t}**${kanban_no}`;
//     }

//     // Fallback — unknown group: no QR
//     return null;
// };

// // ── GET /api/operator/slip?slip_no=&kanban_no= ────────────────────────────────
// export const getSlip = async (req, res) => {
//     const { slip_no, kanban_no } = req.query;

//     if (!slip_no || !kanban_no) {
//         return res.status(400).json({ message: 'slip_no and kanban_no are required.' });
//     }

//     try {
//         const [slips] = await pool.query(
//             'SELECT * FROM slip_data WHERE slip_no = ? AND kanban_no = ?',
//             [slip_no.trim(), kanban_no.trim()]
//         );

//         if (slips.length === 0) {
//             return res.status(404).json({ message: 'Slip not found. Please check Slip No and Kanban No.' });
//         }

//         const slip = slips[0];

//         // Look up predefined_data using item_code as part_code
//         const [predefinedRows] = await pool.query(
//             'SELECT * FROM predefined_data WHERE part_code = ? LIMIT 1',
//             [slip.item_code]
//         );
//         const predefined = predefinedRows[0] || null;

//         const qr_string = buildQrString(predefined?.material_group, predefined, kanban_no.trim());

//         res.json({
//             slip_no: slip.slip_no,
//             kanban_no: slip.kanban_no,
//             item_code: slip.item_code,
//             item_name: slip.item_name,
//             issue_qty: slip.issue_qty,
//             material_type: slip.material_type,
//             rack_no: slip.rack_no,
//             supp_part_no: slip.supp_part_no || predefined?.wire_type_name || slip.item_code,
//             qr_string,
//         });

//     } catch (error) {
//         console.error('getSlip error:', error);
//         res.status(500).json({ error: error.message });
//     }
// };

// // ── POST /api/operator/print  ─────────────────────────────────────────────────
// export const printSlip = async (req, res) => {
//     const { slip_no, kanban_no } = req.body;
//     const operator_username = req.user?.username || req.body.operator_username || null;

//     try {
//         const [slips] = await pool.query(
//             'SELECT * FROM slip_data WHERE slip_no = ? AND kanban_no = ?',
//             [slip_no, kanban_no]
//         );

//         if (slips.length === 0) {
//             return res.status(404).json({ message: 'Slip not found.' });
//         }

//         const slip = slips[0];

//         // is_locked = reprint gate (0 = can print, 1 = locked, unlocked by incharge approval)
//         // print_count = cumulative total prints (never reset)
//         if (slip.is_locked) {
//             return res.status(403).json({ message: 'Slip already printed.', requires_approval: true });
//         }

//         await pool.query(
//             'UPDATE slip_data SET print_count = print_count + 1, is_locked = 1, last_printed_by = ?, last_printed_at = NOW() WHERE slip_no = ? AND kanban_no = ?',
//             [operator_username, slip_no, kanban_no]
//         );

//         // ── Log the print event for reporting ──
//         await pool.query(
//             'INSERT INTO print_logs (slip_no, kanban_no, item_code, material_type, operator_username) VALUES (?, ?, ?, ?, ?)',
//             [slip_no, kanban_no, slip.item_code, slip.material_type, operator_username]
//         );

//         res.json({ message: 'Print command sent successfully.' });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };

// // ── POST /api/operator/request-reprint ───────────────────────────────────────
// export const requestReprint = async (req, res) => {
//     const { slip_no, kanban_no, operator_username } = req.body;

//     try {
//         if (!kanban_no) {
//             return res.status(400).json({ message: 'Kanban Number is missing from the reprint request.' });
//         }

//         const [existing] = await pool.query(
//             'SELECT * FROM print_requests WHERE slip_no = ? AND kanban_no = ? AND status = "pending"',
//             [slip_no, kanban_no]
//         );

//         if (existing.length > 0) {
//             return res.status(400).json({ message: 'A reprint request is already pending for this slip.' });
//         }

//         await pool.query(
//             'INSERT INTO print_requests (slip_no, kanban_no, operator_username, status) VALUES (?, ?, ?, "pending")',
//             [slip_no, kanban_no, operator_username]
//         );

//         res.json({ message: 'Reprint request sent to Incharge successfully.' });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };
