import { poolPromise } from './db.js';

async function runMigration() {
    try {
        console.log('Connecting to database...');
        const pool = await poolPromise;
        
        console.log('Checking if target_print_count column exists in slip_data...');
        
        const result = await pool.request().query(`
            IF NOT EXISTS (
                SELECT * FROM sys.columns 
                WHERE object_id = OBJECT_ID('slip_data') AND name = 'target_print_count'
            )
            BEGIN
                ALTER TABLE slip_data ADD target_print_count INT DEFAULT 1;
                SELECT 'Column target_print_count added successfully.' as statusMessage;
            END
            ELSE
            BEGIN
                SELECT 'Column target_print_count already exists. No action taken.' as statusMessage;
            END
        `);

        if (result.recordset && result.recordset.length > 0) {
            console.log(result.recordset[0].statusMessage);
        }

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
