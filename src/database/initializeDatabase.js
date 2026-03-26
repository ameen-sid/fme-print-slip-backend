import { poolPromise } from './db.js';

export async function initializeDatabase() {
  try {
    const pool = await poolPromise;

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' and xtype='U')
      CREATE TABLE users (
        id INT IDENTITY(1,1) PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'incharge', 'operator')),
        created_at DATETIME DEFAULT GETDATE()
      )
    `);

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='predefined_data' and xtype='U')
      CREATE TABLE predefined_data (
        id INT IDENTITY(1,1) PRIMARY KEY,
        material_group VARCHAR(255),
        part_code VARCHAR(255),
        wire_type_name VARCHAR(255),
        wire_size VARCHAR(255),
        wire_colour VARCHAR(255),
        wire_stripe VARCHAR(255),
        special_character VARCHAR(255)
      )
    `);

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='slip_data' and xtype='U')
      CREATE TABLE slip_data (
        id INT IDENTITY(1,1) PRIMARY KEY,
        slip_no VARCHAR(255),
        lot_no VARCHAR(255),
        slip_date VARCHAR(255),
        slip_time VARCHAR(255),
        item_code VARCHAR(255),
        item_name VARCHAR(255),
        kanban_no VARCHAR(255),
        rack_no VARCHAR(255),
        issue_qty VARCHAR(255),
        user_id VARCHAR(255),
        to_location VARCHAR(255),
        status VARCHAR(255),
        remarks TEXT,
        material_type VARCHAR(255),
        mfr_part_no VARCHAR(255),
        print_count INT DEFAULT 0,
        target_print_count INT DEFAULT 1,
        is_locked BIT DEFAULT 0,
        last_printed_by VARCHAR(255),
        last_printed_at DATETIME
      )
    `);

    // Proactively add missing columns if table already exists
    const alterColumns = [
      { name: 'mfr_part_no', type: 'VARCHAR(255)' },
      { name: 'target_print_count', type: 'INT DEFAULT 1' },
      { name: 'is_locked', type: 'BIT DEFAULT 0' },
      { name: 'last_printed_by', type: 'VARCHAR(255)' },
      { name: 'last_printed_at', type: 'DATETIME' }
    ];

    for (const col of alterColumns) {
      await pool.request().query(`
        IF NOT EXISTS (
          SELECT * FROM sys.columns 
          WHERE object_id = OBJECT_ID('slip_data') AND name = '${col.name}'
        )
        ALTER TABLE slip_data ADD ${col.name} ${col.type};
      `);
    }

    // Migration: Rename supp_part_no to mfr_part_no if it exists
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('slip_data') AND name = 'supp_part_no')
      AND NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('slip_data') AND name = 'mfr_part_no')
      BEGIN
        EXEC sp_rename 'slip_data.supp_part_no', 'mfr_part_no', 'COLUMN';
      END
    `);

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='print_requests' and xtype='U')
      CREATE TABLE print_requests (
        id INT IDENTITY(1,1) PRIMARY KEY,
        slip_no VARCHAR(255) NOT NULL,
        kanban_no VARCHAR(255) NOT NULL,
        operator_username VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        created_at DATETIME DEFAULT GETDATE()
      )
    `);

    // Create Index for print_requests
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_print_requests_slip_no' AND object_id = OBJECT_ID('print_requests'))
      CREATE INDEX IX_print_requests_slip_no ON print_requests (slip_no);
    `);

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='print_logs' and xtype='U')
      CREATE TABLE print_logs (
        id INT IDENTITY(1,1) PRIMARY KEY,
        slip_no VARCHAR(255) NOT NULL,
        kanban_no VARCHAR(255) NOT NULL,
        item_code VARCHAR(255),
        material_type VARCHAR(255),
        operator_username VARCHAR(255) NOT NULL,
        printed_at DATETIME DEFAULT GETDATE()
      )
    `);

    // Create Indexes for print_logs
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_print_logs_printed_at' AND object_id = OBJECT_ID('print_logs'))
      CREATE INDEX IX_print_logs_printed_at ON print_logs (printed_at);

      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_print_logs_operator_username' AND object_id = OBJECT_ID('print_logs'))
      CREATE INDEX IX_print_logs_operator_username ON print_logs (operator_username);

      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_print_logs_slip_no' AND object_id = OBJECT_ID('print_logs'))
      CREATE INDEX IX_print_logs_slip_no ON print_logs (slip_no);
    `);

    console.log('Database tables initialized successfully.');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}



// import pool from './db.js';

// // Helper function to initialize database tables
// export async function initializeDatabase() {
//   try {
//     const connection = await pool.getConnection();

//     await connection.query(`
//       CREATE TABLE IF NOT EXISTS users (
//         id INT AUTO_INCREMENT PRIMARY KEY,
//         username VARCHAR(255) UNIQUE NOT NULL,
//         full_name VARCHAR(255) NOT NULL,
//         password_hash VARCHAR(255) NOT NULL,
//         role ENUM('admin', 'incharge', 'operator') NOT NULL,
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//       )
//     `);

//     await connection.query(`
//       CREATE TABLE IF NOT EXISTS predefined_data (
//         id INT AUTO_INCREMENT PRIMARY KEY,
//         material_group VARCHAR(255),
//         part_code VARCHAR(255),
//         wire_type_name VARCHAR(255),
//         wire_size VARCHAR(255),
//         wire_colour VARCHAR(255),
//         wire_stripe VARCHAR(255),
//         special_character VARCHAR(255)
//       )
//     `);

//     await connection.query(`
//       CREATE TABLE IF NOT EXISTS slip_data (
//         id INT AUTO_INCREMENT PRIMARY KEY,
//         slip_no VARCHAR(255),
//         lot_no VARCHAR(255),
//         slip_date VARCHAR(255),
//         slip_time VARCHAR(255),
//         item_code VARCHAR(255),
//         item_name VARCHAR(255),
//         kanban_no VARCHAR(255),
//         rack_no VARCHAR(255),
//         issue_qty VARCHAR(255),
//         user_id VARCHAR(255),
//         to_location VARCHAR(255),
//         status VARCHAR(255),
//         remarks TEXT,
//         material_type VARCHAR(255),
//         print_count INT DEFAULT 0
//       )
//     `);

//     await connection.query(`
//       CREATE TABLE IF NOT EXISTS print_requests (
//         id INT AUTO_INCREMENT PRIMARY KEY,
//         slip_no VARCHAR(255) NOT NULL,
//         kanban_no VARCHAR(255) NOT NULL,
//         operator_username VARCHAR(255) NOT NULL,
//         status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
//         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         INDEX (slip_no)
//       )
//     `);

//     await connection.query(`
//       CREATE TABLE IF NOT EXISTS print_logs (
//         id INT AUTO_INCREMENT PRIMARY KEY,
//         slip_no VARCHAR(255) NOT NULL,
//         kanban_no VARCHAR(255) NOT NULL,
//         item_code VARCHAR(255),
//         material_type VARCHAR(255),
//         operator_username VARCHAR(255) NOT NULL,
//         printed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//         INDEX (printed_at),
//         INDEX (operator_username),
//         INDEX (slip_no)
//       )
//     `);

//     console.log('Database tables initialized successfully.');
//     connection.release();
//   } catch (error) {
//     console.error('Error initializing database:', error);
//   }
// }