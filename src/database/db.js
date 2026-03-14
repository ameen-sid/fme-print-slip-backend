import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const sqlConfig = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'print_slip_app',
  server: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 1433,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

const poolPromise = new sql.ConnectionPool(sqlConfig)
  .connect()
  .then(pool => {
    console.log('Connected to MSSQL Database');
    return pool;
  })
  .catch(err => console.log('Database Connection Failed! Bad Config: ', err));

export { sql, poolPromise };



// import mysql from 'mysql2/promise';
// import dotenv from 'dotenv';
// dotenv.config();

// const pool = mysql.createPool({
//   host: process.env.DB_HOST || 'localhost',
//   user: process.env.DB_USER || 'root',
//   password: process.env.DB_PASSWORD || 'root',
//   database: process.env.DB_NAME || 'print_slip_app',
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0,
//   timezone: 'Z', // Fixes dates being read as local instead of UTC

//   // Keep connections alive so MySQL doesn't drop idle ones (ECONNRESET fix)
//   enableKeepAlive: true,
//   keepAliveInitialDelay: 10000, // 10s
//   connectTimeout: 20000,        // 20s
//   idleTimeout: 60000,           // release connection if idle > 60s
//   maxIdle: 5,
// });

// export default pool;