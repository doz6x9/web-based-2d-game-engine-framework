import express, { Request, Response } from 'express';
import { Pool, QueryResult } from 'pg'; // <-- Import QueryResult for proper typing
import mapRouter from './src/mapRouter'; // <-- Router for map data endpoints

const app = express();
const PORT = 3000;

// --- 1. POSTGRESQL CONNECTION SETUP ---
// IMPORTANT: Replace these placeholders with your actual PostgreSQL credentials!
// The 'doz' values are placeholders based on the provided logs.
const pool = new Pool({
    user: 'doz',       
    host: 'localhost',          
    database: 'grid_engine_db', 
    password: 'doz', 
    port: 5432,                 
});

// Middleware to parse JSON bodies
app.use(express.json());

// --- 2. API ROUTERS ---

// Map Router: all endpoints start with /api/maps
app.use('/api/maps', mapRouter);

// Test API Endpoint (Legacy/Root Status)
// Renamed 'req' to '_req' to satisfy TS compiler (TS6133) since it's not used here.
app.get('/api/status', (_req: Request, res: Response) => { 
    res.status(200).json({ 
        status: 'OK', 
        service: 'Web Engine Backend API',
        message: 'Ready for integration.'
    });
});

// --- 3. DATABASE CHECK AND SERVER START ---

// Test the connection to the PostgreSQL database by running a simple query
// Added explicit types (Error | null, QueryResult) to fix TS7006.
pool.query('SELECT NOW()', (err: Error | null, res: QueryResult) => { 
  if (err) {
    // Log a critical error and prevent the server from starting
    console.error('❌ Database connection error. Server NOT started:', err.stack);
    console.log('Please ensure PostgreSQL is running and credentials in server.ts are correct.');
  } else {
    console.log('✅ Database connection SUCCESS. Current time:', res.rows[0].now);
    
    // Start the Express server only if the DB connection is successful
    app.listen(PORT, () => {
        console.log(`\nBackend API running at http://localhost:${PORT}`);
        console.log('Test endpoint: http://localhost:3000/api/status');
    });
  }
});

// Export the pool instance so other services (like mapService.ts) can use it later
export { pool };
