import bcrypt from 'bcryptjs';
import xlsx from 'xlsx';
import { sql, poolPromise } from '../database/db.js';

// --- User Management ---

export const getUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';

        const pool = await poolPromise;
        const request = pool.request();

        let query = 'SELECT id, username, full_name, role, created_at FROM users';
        let countQuery = 'SELECT COUNT(*) as total FROM users';

        if (search) {
            request.input('search', sql.VarChar, `%${search}%`);
            const searchClause = ' WHERE username LIKE @search OR full_name LIKE @search OR role LIKE @search';
            query += searchClause;
            countQuery += searchClause;
        }

        query += ' ORDER BY created_at DESC OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY';

        const countResult = await request.query(countQuery);
        const total = countResult.recordset[0].total;

        request.input('limit', sql.Int, limit);
        request.input('offset', sql.Int, offset);
        
        const usersResult = await request.query(query);

        res.json({
            data: usersResult.recordset,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('getUsers error:', error);
        res.status(500).json({ error: error.message });
    }
};

export const createUser = async (req, res) => {
    const { username, full_name, password, role } = req.body;
    try {
        const pool = await poolPromise;
        const passwordHash = await bcrypt.hash(password, 10);
        
        const result = await pool.request()
            .input('username', sql.VarChar, username)
            .input('full_name', sql.VarChar, full_name)
            .input('passwordHash', sql.VarChar, passwordHash)
            .input('role', sql.VarChar, role)
            .query(`
                INSERT INTO users (username, full_name, password_hash, role) 
                OUTPUT INSERTED.id 
                VALUES (@username, @full_name, @passwordHash, @role)
            `);
            
        res.json({ id: result.recordset[0].id, username, full_name, role });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM users WHERE id = @id');
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const updateUser = async (req, res) => {
    const { username, full_name, password, role } = req.body;
    try {
        const pool = await poolPromise;
        const request = pool.request()
            .input('username', sql.VarChar, username)
            .input('full_name', sql.VarChar, full_name)
            .input('role', sql.VarChar, role)
            .input('id', sql.Int, req.params.id);

        let query = 'UPDATE users SET username = @username, full_name = @full_name, role = @role WHERE id = @id';

        if (password) {
            const passwordHash = await bcrypt.hash(password, 10);
            request.input('passwordHash', sql.VarChar, passwordHash);
            query = 'UPDATE users SET username = @username, full_name = @full_name, password_hash = @passwordHash, role = @role WHERE id = @id';
        }

        await request.query(query);
        res.json({ message: 'User updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- Predefined Data Management ---

export const getPredefinedData = async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM predefined_data');
        res.json(result.recordset);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const createPredefinedData = async (req, res) => {
    const { material_group, part_code, wire_type_name, wire_size, wire_colour, wire_stripe, special_character } = req.body;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('material_group', sql.VarChar, material_group)
            .input('part_code', sql.VarChar, part_code)
            .input('wire_type_name', sql.VarChar, wire_type_name)
            .input('wire_size', sql.VarChar, wire_size)
            .input('wire_colour', sql.VarChar, wire_colour)
            .input('wire_stripe', sql.VarChar, wire_stripe)
            .input('special_character', sql.VarChar, special_character)
            .query(`
                INSERT INTO predefined_data (material_group, part_code, wire_type_name, wire_size, wire_colour, wire_stripe, special_character) 
                OUTPUT INSERTED.id
                VALUES (@material_group, @part_code, @wire_type_name, @wire_size, @wire_colour, @wire_stripe, @special_character)
            `);
        res.json({ id: result.recordset[0].id, ...req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const updatePredefinedData = async (req, res) => {
    const { material_group, part_code, wire_type_name, wire_size, wire_colour, wire_stripe, special_character } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('material_group', sql.VarChar, material_group)
            .input('part_code', sql.VarChar, part_code)
            .input('wire_type_name', sql.VarChar, wire_type_name)
            .input('wire_size', sql.VarChar, wire_size)
            .input('wire_colour', sql.VarChar, wire_colour)
            .input('wire_stripe', sql.VarChar, wire_stripe)
            .input('special_character', sql.VarChar, special_character)
            .input('id', sql.Int, req.params.id)
            .query(`
                UPDATE predefined_data 
                SET material_group=@material_group, part_code=@part_code, wire_type_name=@wire_type_name, 
                    wire_size=@wire_size, wire_colour=@wire_colour, wire_stripe=@wire_stripe, special_character=@special_character 
                WHERE id=@id
            `);
        res.json({ message: 'Data updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const deletePredefinedData = async (req, res) => {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM predefined_data WHERE id = @id');
        res.json({ message: 'Record deleted successfully.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- Stats ---

export const getStats = async (req, res) => {
    try {
        const pool = await poolPromise;
        const slipCount = await pool.request().query('SELECT COUNT(*) as count FROM slip_data');
        const userCount = await pool.request().query('SELECT COUNT(*) as count FROM users');
        const predefinedCount = await pool.request().query('SELECT COUNT(*) as count FROM predefined_data');
        const pendingCount = await pool.request().query("SELECT COUNT(*) as count FROM print_requests WHERE status = 'pending'");
        
        res.json({
            slip_data: slipCount.recordset[0].count,
            users: userCount.recordset[0].count,
            predefined_data: predefinedCount.recordset[0].count,
            pending_requests: pendingCount.recordset[0].count,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- Delete Slip Data by Date Range ---
export const deleteSlipDataByRange = async (req, res) => {
    const { from_date, to_date } = req.body;
    if (!from_date || !to_date) {
        return res.status(400).json({ error: 'from_date and to_date are required.' });
    }
    if (from_date > to_date) {
        return res.status(400).json({ error: 'from_date must be on or before to_date.' });
    }
    try {
        const pool = await poolPromise;
        // 104 corresponds to German format dd.mm.yyyy which matches JS's "DD.MM.YYYY"
        const result = await pool.request()
            .input('from_date', sql.VarChar, from_date)
            .input('to_date', sql.VarChar, to_date)
            .query(`
                DELETE FROM slip_data
                WHERE CONVERT(DATE, slip_date, 104) BETWEEN CONVERT(DATE, @from_date) AND CONVERT(DATE, @to_date)
            `);
            
        res.json({
            message: `Deleted ${result.rowsAffected[0]} record(s) between ${from_date} and ${to_date}.`,
            deleted: result.rowsAffected[0]
        });
    } catch (error) {
        console.error('deleteSlipDataByRange error:', error);
        res.status(500).json({ error: error.message });
    }
};

// --- Slip Data View (admin + incharge) ---
export const getSlipDataView = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const today = req.query.today === '1';

        const pool = await poolPromise;
        const request = pool.request();

        const conditions = [];

        if (search) {
            conditions.push('(slip_no LIKE @search OR kanban_no LIKE @search OR item_code LIKE @search OR item_name LIKE @search)');
            request.input('search', sql.VarChar, `%${search}%`);
        }
        if (today) {
            conditions.push('CAST(last_printed_at AS DATE) = CAST(GETDATE() AS DATE)');
        }

        const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';

        const countResult = await request.query(`SELECT COUNT(*) as total FROM slip_data${where}`);
        const total = countResult.recordset[0].total;

        request.input('limit', sql.Int, limit);
        request.input('offset', sql.Int, offset);

        const rowsResult = await request.query(`
            SELECT slip_no, lot_no, slip_date, slip_time, item_code, item_name,
                   kanban_no, rack_no, issue_qty, to_location,
                   status, material_type, mfr_part_no, print_count,
                   is_locked, last_printed_by, last_printed_at
            FROM slip_data${where}
            ORDER BY slip_no DESC
            OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `);

        res.json({ data: rowsResult.recordset, total, page, limit, totalPages: Math.ceil(total / limit) });
    } catch (error) {
        console.error('getSlipDataView error:', error);
        res.status(500).json({ error: error.message });
    }
};

// --- Excel Upload for Slip Data ---

export const uploadExcelData = async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    try {
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false });
        
        const data = rawData.filter(row => {
            const sn = row['Slip_no'] || row['Slip No'];
            return sn !== undefined && sn !== null && String(sn).trim() !== '';
        });

        if (data.length === 0) {
            return res.status(400).json({ message: 'The Excel file is empty.' });
        }

        const pool = await poolPromise;

        let hasSuppPartNo = false;
        try {
            await pool.request().query('SELECT TOP 1 mfr_part_no FROM slip_data');
            hasSuppPartNo = true;
        } catch { /* column not added yet — skip it */ }

        let inserted = 0, skipped = 0, failed = 0;
        const rowErrors = [];

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            try {
                const reqRow = pool.request();
                reqRow.input('slip_no', sql.VarChar, String(row['Slip_no'] || row['Slip No'] || ''));
                reqRow.input('lot_no', sql.VarChar, String(row['Lot Number'] || row['Lot No'] || ''));
                reqRow.input('slip_date', sql.VarChar, String(row['Slip Date'] || ''));
                reqRow.input('slip_time', sql.VarChar, String(row['Slip Time'] || ''));
                reqRow.input('item_code', sql.VarChar, String(row['Item Code'] || row['Item code'] || ''));
                reqRow.input('item_name', sql.VarChar, String(row['Item Name'] || row['Item name'] || ''));
                reqRow.input('kanban_no', sql.VarChar, String(row['Kanban Number'] || row['Kanban No'] || ''));
                reqRow.input('rack_no', sql.VarChar, String(row['Rack No'] || ''));
                reqRow.input('issue_qty', sql.VarChar, String(row['Issue Qty'] || ''));
                reqRow.input('user_id', sql.VarChar, String(row['User ID'] || row['User id'] || ''));
                reqRow.input('to_location', sql.VarChar, String(row['To Location'] || row['To location'] || ''));
                reqRow.input('status', sql.VarChar, String(row['Status'] || ''));
                reqRow.input('remarks', sql.VarChar, String(row['Remarks'] || ''));
                reqRow.input('material_type', sql.VarChar, String(row['Material Type'] || row['Mat Type'] || ''));
                
                let queryStr = '';
                if (hasSuppPartNo) {
                    reqRow.input('mfr_part_no', sql.VarChar, String(row['Mfr Part No'] || row['Supp. Part No.'] || ''));
                    // MSSQL equivalent of INSERT IGNORE
                    queryStr = `
                        BEGIN TRY
                            INSERT INTO slip_data
                            (slip_no, lot_no, slip_date, slip_time, item_code, item_name, kanban_no, rack_no,
                             issue_qty, user_id, to_location, status, remarks, material_type, mfr_part_no)
                            VALUES (@slip_no, @lot_no, @slip_date, @slip_time, @item_code, @item_name, @kanban_no, @rack_no,
                             @issue_qty, @user_id, @to_location, @status, @remarks, @material_type, @mfr_part_no);
                            SELECT 1 AS inserted_flag;
                        END TRY
                        BEGIN CATCH
                            -- 2601/2627 are Unique Key/Primary Key violation errors
                            IF ERROR_NUMBER() IN (2601, 2627) SELECT 0 AS inserted_flag ELSE THROW;
                        END CATCH
                    `;
                } else {
                    queryStr = `
                        BEGIN TRY
                            INSERT INTO slip_data
                            (slip_no, lot_no, slip_date, slip_time, item_code, item_name, kanban_no, rack_no,
                             issue_qty, user_id, to_location, status, remarks, material_type)
                            VALUES (@slip_no, @lot_no, @slip_date, @slip_time, @item_code, @item_name, @kanban_no, @rack_no,
                             @issue_qty, @user_id, @to_location, @status, @remarks, @material_type);
                            SELECT 1 AS inserted_flag;
                        END TRY
                        BEGIN CATCH
                            IF ERROR_NUMBER() IN (2601, 2627) SELECT 0 AS inserted_flag ELSE THROW;
                        END CATCH
                    `;
                }

                const queryResult = await reqRow.query(queryStr);
                
                if (queryResult.recordset && queryResult.recordset[0].inserted_flag === 1) {
                    inserted++;
                } else {
                    skipped++;
                }

            } catch (rowErr) {
                failed++;
                const msg = `Row ${i + 2} (Slip No: ${row['Slip No']}): ${rowErr.message}`;
                rowErrors.push(msg);
                console.error('Row insert error:', msg);
            }
        }

        const summary = `Uploaded ${inserted} of ${data.length} records.` +
            (skipped ? ` ${skipped} duplicates skipped.` : '') +
            (failed ? ` ${failed} rows failed.` : '');

        if (failed > 0 && inserted === 0) {
            return res.status(500).json({
                error: summary,
                details: rowErrors.slice(0, 5)   // first 5 errors
            });
        }

        res.json({
            message: summary,
            ...(rowErrors.length ? { warnings: rowErrors.slice(0, 5) } : {})
        });

    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ error: error.message || 'Failed to process Excel file' });
    }
};

// --- Download Slip Data Template (xlsx) ---
export const downloadTemplate = (req, res) => {
    const columns = [
        'Slip_no', 'Lot Number', 'Slip Date', 'Slip Time',
        'Item Code', 'Item Name', 'Kanban Number', 'Rack No',
        'Issue Qty', 'User ID', 'To Location',
        'Status', 'Remarks', 'Material Type', 'Mfr Part No'
    ];

    const sampleRow = [
        'SL-001', 'LT-001', '2024-01-01', '09:00:00',
        'ITEM-001', 'Wire Harness A', 'KB-001', 'R-01',
        100, 'U-001', 'Line 1',
        'Active', '', 'Type-A', 'SUP-PART-001'
    ];

    const ws = xlsx.utils.aoa_to_sheet([columns, sampleRow]);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'slip_data');

    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="slip_data_template.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
};

// --- Excel Upload for Predefined Data (DEV ONLY) ---

export const uploadPredefinedExcel = async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    try {
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        const pool = await poolPromise;
        await pool.request().query('TRUNCATE TABLE predefined_data');

        for (const row of data) {
            const reqRow = pool.request();
            reqRow.input('material_group', sql.VarChar, row['Material Group'] || row['material_group'] || null);
            reqRow.input('part_code', sql.VarChar, row['Part Code'] || row['part_code'] || null);
            reqRow.input('wire_type_name', sql.VarChar, row['Wire Type'] || row['wire_type_name'] || null);
            reqRow.input('wire_size', sql.VarChar, row['Wire Size'] || row['wire_size'] || null);
            reqRow.input('wire_colour', sql.VarChar, row['Wire Colour'] || row['wire_colour'] || null);
            reqRow.input('wire_stripe', sql.VarChar, row['Wire Stripe'] || row['wire_stripe'] || null);
            reqRow.input('special_character', sql.VarChar, row['Special Character'] || row['special_character'] || null);

            await reqRow.query(`
                INSERT INTO predefined_data 
                (material_group, part_code, wire_type_name, wire_size, wire_colour, wire_stripe, special_character) 
                VALUES (@material_group, @part_code, @wire_type_name, @wire_size, @wire_colour, @wire_stripe, @special_character)
            `);
        }

        res.json({ message: `Successfully uploaded ${data.length} predefined records.` });
    } catch (error) {
        console.error('Predefined Upload Error:', error);
        res.status(500).json({ error: 'Failed to process predefined data Excel file' });
    }
};

// --- Reporting (Record of which operator printed which slips) ---

export const getPrintReports = async (req, res) => {
    try {
        const { startDate, endDate, operator, slipNo, materialType, page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const pool = await poolPromise;
        const request = pool.request();

        let conditions = [];

        if (startDate && endDate) {
            conditions.push('printed_at BETWEEN @startDate AND @endDate');
            request.input('startDate', sql.DateTime, `${startDate} 00:00:00`);
            request.input('endDate', sql.DateTime, `${endDate} 23:59:59`);
        }
        if (operator) {
            conditions.push('operator_username = @operator');
            request.input('operator', sql.VarChar, operator);
        }
        if (slipNo) {
            conditions.push('slip_no LIKE @slipNo');
            request.input('slipNo', sql.VarChar, `%${slipNo}%`);
        }
        if (materialType) {
            conditions.push('material_type = @materialType');
            request.input('materialType', sql.VarChar, materialType);
        }

        const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
        
        // Get total count
        const countResult = await request.query(`SELECT COUNT(*) as total FROM print_logs${where}`);
        const total = countResult.recordset[0].total;
        
        // Get data
        request.input('limit', sql.Int, parseInt(limit));
        request.input('offset', sql.Int, offset);

        const rowsResult = await request.query(`
            SELECT * FROM print_logs${where} 
            ORDER BY printed_at DESC 
            OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        `);

        // Get list of unique operators for the filter dropdown
        const operatorsResult = await pool.request().query('SELECT DISTINCT operator_username FROM print_logs ORDER BY operator_username ASC');

        res.json({
            data: rowsResult.recordset,
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit)),
            operators: operatorsResult.recordset.map(o => o.operator_username)
        });
    } catch (error) {
        console.error('getPrintReports error:', error);
        res.status(500).json({ error: error.message });
    }
};

export const exportPrintReports = async (req, res) => {
    try {
        const { startDate, endDate, operator } = req.query;

        const pool = await poolPromise;
        const request = pool.request();

        let conditions = [];

        if (startDate && endDate) {
            conditions.push('printed_at BETWEEN @startDate AND @endDate');
            request.input('startDate', sql.DateTime, `${startDate} 00:00:00`);
            request.input('endDate', sql.DateTime, `${endDate} 23:59:59`);
        }
        if (operator) {
            conditions.push('operator_username = @operator');
            request.input('operator', sql.VarChar, operator);
        }

        const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
        
        // Used FORMAT for MSSQL instead of DATE_FORMAT
        const rowsResult = await request.query(`
            SELECT slip_no AS "Slip No", kanban_no AS "Kanban No", item_code AS "Item Code", 
                   material_type AS "Material Type", operator_username AS "Operator", 
                   FORMAT(printed_at, 'yyyy-MM-dd HH:mm:ss') AS "Printed At"
            FROM print_logs${where} 
            ORDER BY printed_at DESC
        `);

        if (rowsResult.recordset.length === 0) {
            return res.status(404).json({ message: 'No records found for the selected criteria.' });
        }

        const ws = xlsx.utils.json_to_sheet(rowsResult.recordset);
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Print Reports');

        const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Disposition', 'attachment; filename="print_report.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);
    } catch (error) {
        console.error('exportPrintReports error:', error);
        res.status(500).json({ error: error.message });
    }
};





// import bcrypt from 'bcryptjs';
// import xlsx from 'xlsx';
// import pool from '../database/db.js';

// // --- User Management ---

// export const getUsers = async (req, res) => {
//     try {
//         const page = parseInt(req.query.page) || 1;
//         const limit = parseInt(req.query.limit) || 10;
//         const offset = (page - 1) * limit;
//         const search = req.query.search || '';

//         let query = 'SELECT id, username, full_name, role, created_at FROM users';
//         let countQuery = 'SELECT COUNT(*) as total FROM users';
//         let queryParams = [];

//         if (search) {
//             const searchPattern = `%${search}%`;
//             const searchClause = ' WHERE username LIKE ? OR full_name LIKE ? OR role LIKE ?';
//             query += searchClause;
//             countQuery += searchClause;
//             queryParams.push(searchPattern, searchPattern, searchPattern);
//         }

//         query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

//         // Execute queries
//         const [countResult] = await pool.query(countQuery, queryParams);
//         const total = countResult[0].total;

//         // Push limit and offset parameters
//         queryParams.push(limit, offset);
//         const [users] = await pool.query(query, queryParams);

//         res.json({
//             data: users,
//             total,
//             page,
//             limit,
//             totalPages: Math.ceil(total / limit)
//         });
//     } catch (error) {
//         console.error('getUsers error:', error);
//         res.status(500).json({ error: error.message });
//     }
// };

// export const createUser = async (req, res) => {
//     const { username, full_name, password, role } = req.body;
//     try {
//         const passwordHash = await bcrypt.hash(password, 10);
//         const [result] = await pool.query(
//             'INSERT INTO users (username, full_name, password_hash, role) VALUES (?, ?, ?, ?)',
//             [username, full_name, passwordHash, role]
//         );
//         res.json({ id: result.insertId, username, full_name, role });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };

// export const deleteUser = async (req, res) => {
//     try {
//         await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
//         res.json({ message: 'User deleted successfully' });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };

// export const updateUser = async (req, res) => {
//     const { username, full_name, password, role } = req.body;
//     try {
//         let query = 'UPDATE users SET username = ?, full_name = ?, role = ? WHERE id = ?';
//         let params = [username, full_name, role, req.params.id];

//         if (password) {
//             const passwordHash = await bcrypt.hash(password, 10);
//             query = 'UPDATE users SET username = ?, full_name = ?, password_hash = ?, role = ? WHERE id = ?';
//             params = [username, full_name, passwordHash, role, req.params.id];
//         }

//         await pool.query(query, params);
//         res.json({ message: 'User updated successfully' });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };

// // --- Predefined Data Management ---

// export const getPredefinedData = async (req, res) => {
//     try {
//         const [data] = await pool.query('SELECT * FROM predefined_data');
//         res.json(data);
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };

// export const createPredefinedData = async (req, res) => {
//     const { material_group, part_code, wire_type_name, wire_size, wire_colour, wire_stripe, special_character } = req.body;
//     try {
//         const [result] = await pool.query(
//             'INSERT INTO predefined_data (material_group, part_code, wire_type_name, wire_size, wire_colour, wire_stripe, special_character) VALUES (?, ?, ?, ?, ?, ?, ?)',
//             [material_group, part_code, wire_type_name, wire_size, wire_colour, wire_stripe, special_character]
//         );
//         res.json({ id: result.insertId, ...req.body });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };

// export const updatePredefinedData = async (req, res) => {
//     const { material_group, part_code, wire_type_name, wire_size, wire_colour, wire_stripe, special_character } = req.body;
//     try {
//         await pool.query(
//             'UPDATE predefined_data SET material_group=?, part_code=?, wire_type_name=?, wire_size=?, wire_colour=?, wire_stripe=?, special_character=? WHERE id=?',
//             [material_group, part_code, wire_type_name, wire_size, wire_colour, wire_stripe, special_character, req.params.id]
//         );
//         res.json({ message: 'Data updated successfully' });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };
// export const deletePredefinedData = async (req, res) => {
//     try {
//         await pool.query('DELETE FROM predefined_data WHERE id = ?', [req.params.id]);
//         res.json({ message: 'Record deleted successfully.' });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };

// // --- Stats ---

// export const getStats = async (req, res) => {
//     try {
//         const [[slipCount]] = await pool.query('SELECT COUNT(*) as count FROM slip_data');
//         const [[userCount]] = await pool.query('SELECT COUNT(*) as count FROM users');
//         const [[predefinedCount]] = await pool.query('SELECT COUNT(*) as count FROM predefined_data');
//         const [[pendingCount]] = await pool.query("SELECT COUNT(*) as count FROM print_requests WHERE status = 'pending'");
//         res.json({
//             slip_data: slipCount.count,
//             users: userCount.count,
//             predefined_data: predefinedCount.count,
//             pending_requests: pendingCount.count,
//         });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };

// // --- Delete Slip Data by Date Range ---
// export const deleteSlipDataByRange = async (req, res) => {
//     const { from_date, to_date } = req.body;
//     if (!from_date || !to_date) {
//         return res.status(400).json({ error: 'from_date and to_date are required.' });
//     }
//     if (from_date > to_date) {
//         return res.status(400).json({ error: 'from_date must be on or before to_date.' });
//     }
//     try {
//         // slip_date is stored as DD.MM.YYYY string — use STR_TO_DATE to parse before comparing
//         const [result] = await pool.query(
//             `DELETE FROM slip_data
//              WHERE STR_TO_DATE(slip_date, '%d.%m.%Y') BETWEEN ? AND ?`,
//             [from_date, to_date]
//         );
//         res.json({
//             message: `Deleted ${result.affectedRows} record(s) between ${from_date} and ${to_date}.`,
//             deleted: result.affectedRows
//         });
//     } catch (error) {
//         console.error('deleteSlipDataByRange error:', error);
//         res.status(500).json({ error: error.message });
//     }
// };

// // --- Slip Data View (admin + incharge) ---
// export const getSlipDataView = async (req, res) => {
//     try {
//         const page = parseInt(req.query.page) || 1;
//         const limit = parseInt(req.query.limit) || 20;
//         const offset = (page - 1) * limit;
//         const search = req.query.search || '';
//         const today = req.query.today === '1';

//         const conditions = [];
//         const params = [];

//         if (search) {
//             conditions.push('(slip_no LIKE ? OR kanban_no LIKE ? OR item_code LIKE ? OR item_name LIKE ?)');
//             const s = `%${search}%`;
//             params.push(s, s, s, s);
//         }
//         if (today) {
//             conditions.push('DATE(last_printed_at) = CURDATE()');
//         }

//         const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';

//         const [[{ total }]] = await pool.query(`SELECT COUNT(*) as total FROM slip_data${where}`, params);
//         const [rows] = await pool.query(
//             `SELECT slip_no, lot_no, slip_date, slip_time, item_code, item_name,
//                     kanban_no, rack_no, issue_qty, to_location,
//                     status, material_type, supp_part_no, print_count,
//                     is_locked, last_printed_by, last_printed_at
//              FROM slip_data${where}
//              ORDER BY slip_no DESC
//              LIMIT ? OFFSET ?`,
//             [...params, limit, offset]
//         );

//         res.json({ data: rows, total, page, limit, totalPages: Math.ceil(total / limit) });
//     } catch (error) {
//         console.error('getSlipDataView error:', error);
//         res.status(500).json({ error: error.message });
//     }
// };

// // --- Excel Upload for Slip Data ---

// export const uploadExcelData = async (req, res) => {
//     if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

//     try {
//         const workbook = xlsx.readFile(req.file.path);
//         const sheetName = workbook.SheetNames[0];
//         // Use { raw: false } to get formatted text (e.g., '09-03-2026', '12:08:02 AM') instead of serial numbers
//         const rawData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { raw: false });
//         // Skip completely empty rows (no Slip_no value fallback to Slip No just in case)
//         const data = rawData.filter(row => {
//             const sn = row['Slip_no'] || row['Slip No'];
//             return sn !== undefined && sn !== null && String(sn).trim() !== '';
//         });

//         if (data.length === 0) {
//             return res.status(400).json({ message: 'The Excel file is empty.' });
//         }

//         // Check whether the supp_part_no column exists (added via ALTER TABLE)
//         let hasSuppPartNo = false;
//         try {
//             await pool.query('SELECT supp_part_no FROM slip_data LIMIT 1');
//             hasSuppPartNo = true;
//         } catch { /* column not added yet — skip it */ }

//         let inserted = 0, skipped = 0, failed = 0;
//         const rowErrors = [];

//         for (let i = 0; i < data.length; i++) {
//             const row = data[i];
//             try {
//                 const slipTime = row['Slip Time'] || null;

//                 let queryResult;
//                 if (hasSuppPartNo) {
//                     [queryResult] = await pool.query(
//                         `INSERT IGNORE INTO slip_data
//                          (slip_no, lot_no, slip_date, slip_time, item_code, item_name, kanban_no, rack_no,
//                           issue_qty, user_id, to_location, status, remarks, material_type,
//                           supp_part_no)
//                          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
//                         [
//                             row['Slip_no'] || row['Slip No'], row['Lot Number'] || row['Lot No'], row['Slip Date'], slipTime,
//                             row['Item Code'] || row['Item code'], row['Item Name'] || row['Item name'], row['Kanban Number'] || row['Kanban No'], row['Rack No'],
//                             row['Issue Qty'], row['User ID'] || row['User id'], row['To Location'] || row['To location'],
//                             row['Status'], row['Remarks'],
//                             row['Material Type'] || row['Mat Type'],
//                             row['Mfr Part No'] || row['Supp. Part No.'] || null
//                         ]
//                     );
//                 } else {
//                     [queryResult] = await pool.query(
//                         `INSERT IGNORE INTO slip_data
//                          (slip_no, lot_no, slip_date, slip_time, item_code, item_name, kanban_no, rack_no,
//                           issue_qty, user_id, to_location, status, remarks, material_type)
//                          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
//                         [
//                             row['Slip_no'] || row['Slip No'], row['Lot Number'] || row['Lot No'], row['Slip Date'], slipTime,
//                             row['Item Code'] || row['Item code'], row['Item Name'] || row['Item name'], row['Kanban Number'] || row['Kanban No'], row['Rack No'],
//                             row['Issue Qty'], row['User ID'] || row['User id'], row['To Location'] || row['To location'],
//                             row['Status'], row['Remarks'],
//                             row['Material Type'] || row['Mat Type']
//                         ]
//                     );
//                 }

//                 // INSERT IGNORE returns affectedRows=0 for skipped duplicates
//                 if (queryResult.affectedRows > 0) {
//                     inserted++;
//                 } else {
//                     skipped++;
//                 }

//             } catch (rowErr) {
//                 failed++;
//                 const msg = `Row ${i + 2} (Slip No: ${row['Slip No']}): ${rowErr.message}`;
//                 rowErrors.push(msg);
//                 console.error('Row insert error:', msg);
//             }
//         }

//         const summary = `Uploaded ${inserted} of ${data.length} records.` +
//             (skipped ? ` ${skipped} duplicates skipped.` : '') +
//             (failed ? ` ${failed} rows failed.` : '');

//         if (failed > 0 && inserted === 0) {
//             return res.status(500).json({
//                 error: summary,
//                 details: rowErrors.slice(0, 5)   // first 5 errors
//             });
//         }

//         res.json({
//             message: summary,
//             ...(rowErrors.length ? { warnings: rowErrors.slice(0, 5) } : {})
//         });

//     } catch (error) {
//         console.error('Upload Error:', error);
//         res.status(500).json({ error: error.message || 'Failed to process Excel file' });
//     }
// };

// // --- Download Slip Data Template (xlsx) ---
// export const downloadTemplate = (req, res) => {
//     const columns = [
//         'Slip_no', 'Lot Number', 'Slip Date', 'Slip Time',
//         'Item Code', 'Item Name', 'Kanban Number', 'Rack No',
//         'Issue Qty', 'User ID', 'To Location',
//         'Status', 'Remarks', 'Material Type', 'Mfr Part No'
//     ];

//     const sampleRow = [
//         'SL-001', 'LT-001', '2024-01-01', '09:00:00',
//         'ITEM-001', 'Wire Harness A', 'KB-001', 'R-01',
//         100, 'U-001', 'Line 1',
//         'Active', '', 'Type-A', 'SUP-PART-001'
//     ];

//     const ws = xlsx.utils.aoa_to_sheet([columns, sampleRow]);
//     const wb = xlsx.utils.book_new();
//     xlsx.utils.book_append_sheet(wb, ws, 'slip_data');

//     const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
//     res.setHeader('Content-Disposition', 'attachment; filename="slip_data_template.xlsx"');
//     res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
//     res.send(buf);
// };

// // --- Excel Upload for Predefined Data (DEV ONLY) ---

// export const uploadPredefinedExcel = async (req, res) => {
//     if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

//     try {
//         const workbook = xlsx.readFile(req.file.path);
//         const sheetName = workbook.SheetNames[0];
//         const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

//         // For dev only: truncate and re-insert
//         await pool.query('TRUNCATE TABLE predefined_data');

//         for (const row of data) {
//             await pool.query(
//                 `INSERT INTO predefined_data 
//         (material_group, part_code, wire_type_name, wire_size, wire_colour, wire_stripe, special_character) 
//         VALUES (?, ?, ?, ?, ?, ?, ?)`,
//                 [
//                     row['Material Group'] || row['material_group'] || null,
//                     row['Part Code'] || row['part_code'] || null,
//                     row['Wire Type'] || row['wire_type_name'] || null,
//                     row['Wire Size'] || row['wire_size'] || null,
//                     row['Wire Colour'] || row['wire_colour'] || null,
//                     row['Wire Stripe'] || row['wire_stripe'] || null,
//                     row['Special Character'] || row['special_character'] || null
//                 ]
//             );
//         }

//         res.json({ message: `Successfully uploaded ${data.length} predefined records.` });
//     } catch (error) {
//         console.error('Predefined Upload Error:', error);
//         res.status(500).json({ error: 'Failed to process predefined data Excel file' });
//     }
// };

// // --- Reporting (Record of which operator printed which slips) ---

// export const getPrintReports = async (req, res) => {
//     try {
//         const { startDate, endDate, operator, slipNo, materialType, page = 1, limit = 20 } = req.query;
//         const offset = (parseInt(page) - 1) * parseInt(limit);

//         let conditions = [];
//         let params = [];

//         if (startDate && endDate) {
//             conditions.push('printed_at BETWEEN ? AND ?');
//             params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
//         }
//         if (operator) {
//             conditions.push('operator_username = ?');
//             params.push(operator);
//         }
//         if (slipNo) {
//             conditions.push('slip_no LIKE ?');
//             params.push(`%${slipNo}%`);
//         }
//         if (materialType) {
//             conditions.push('material_type = ?');
//             params.push(materialType);
//         }

//         const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
        
//         // Get total count
//         const [[{ total }]] = await pool.query(`SELECT COUNT(*) as total FROM print_logs${where}`, params);
        
//         // Get data
//         const [rows] = await pool.query(
//             `SELECT * FROM print_logs${where} ORDER BY printed_at DESC LIMIT ? OFFSET ?`,
//             [...params, parseInt(limit), offset]
//         );

//         // Get list of unique operators for the filter dropdown
//         const [operators] = await pool.query('SELECT DISTINCT operator_username FROM print_logs ORDER BY operator_username ASC');

//         res.json({
//             data: rows,
//             total,
//             page: parseInt(page),
//             limit: parseInt(limit),
//             totalPages: Math.ceil(total / parseInt(limit)),
//             operators: operators.map(o => o.operator_username)
//         });
//     } catch (error) {
//         console.error('getPrintReports error:', error);
//         res.status(500).json({ error: error.message });
//     }
// };

// export const exportPrintReports = async (req, res) => {
//     try {
//         const { startDate, endDate, operator } = req.query;

//         let conditions = [];
//         let params = [];

//         if (startDate && endDate) {
//             conditions.push('printed_at BETWEEN ? AND ?');
//             params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
//         }
//         if (operator) {
//             conditions.push('operator_username = ?');
//             params.push(operator);
//         }

//         const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
        
//         const [rows] = await pool.query(
//             `SELECT slip_no AS "Slip No", kanban_no AS "Kanban No", item_code AS "Item Code", 
//                     material_type AS "Material Type", operator_username AS "Operator", 
//                     DATE_FORMAT(printed_at, '%Y-%m-%d %H:%i:%s') AS "Printed At"
//              FROM print_logs${where} 
//              ORDER BY printed_at DESC`,
//             params
//         );

//         if (rows.length === 0) {
//             return res.status(404).json({ message: 'No records found for the selected criteria.' });
//         }

//         const ws = xlsx.utils.json_to_sheet(rows);
//         const wb = xlsx.utils.book_new();
//         xlsx.utils.book_append_sheet(wb, ws, 'Print Reports');

//         const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
//         res.setHeader('Content-Disposition', 'attachment; filename="print_report.xlsx"');
//         res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
//         res.send(buf);
//     } catch (error) {
//         console.error('exportPrintReports error:', error);
//         res.status(500).json({ error: error.message });
//     }
// };
