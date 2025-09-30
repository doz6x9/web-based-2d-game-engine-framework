import { QueryResult } from 'pg';
// The pool instance is exported from server.ts and represents our active DB connection.
// Path is correct: '../server' because mapService is in 'src/'
import { pool } from '../server'; 

/**
 * Interface representing the structure of a row returned by the 'maps' table query.
 * The 'json_data' is what we are primarily interested in.
 */
interface MapDataRow {
    json_data: any; // PostgreSQL 'jsonb' column will be returned as a JavaScript object
    id: number;
    name: string;
    created_at: Date;
}

/**
 * Retrieves a single map's JSON data based on its unique name.
 * @param mapName The unique name of the map (e.g., 'Test_Map_01').
 * @returns A Promise resolving to the map's JSON data object, or null if not found.
 */
export async function getMapByName(mapName: string): Promise<any | null> {
    const queryText = 'SELECT json_data FROM maps WHERE name = $1';
    
    try {
        const result: QueryResult<MapDataRow> = await pool.query(queryText, [mapName]);
        
        if (result.rows.length > 0) {
            // Return the json_data object
            return result.rows[0].json_data;
        } else {
            // Map not found
            return null;
        }
    } catch (error) {
        console.error(`[MapService] Error fetching map '${mapName}':`, error);
        // Throw the error to be handled by the router/controller
        throw new Error('Database query failed during map retrieval.');
    }
}

/**
 * Future function to get a list of all available map names.
 * Currently returns a placeholder structure.
 * @returns A Promise resolving to an array of map names.
 */
export async function getMapList(): Promise<string[]> {
    // NOTE: This will be implemented in a subsequent step.
    console.log("[MapService] Called getMapList - returning placeholder.");
    return ["MapList not yet implemented."];
}

// Export the pool just in case another file needs direct database access
export { pool };
