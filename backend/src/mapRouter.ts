import express, { Request, Response } from 'express';
// Import the service functions we just defined in mapService.ts
import { getMapByName, getMapList } from './mapService'; 

const router = express.Router();

/**
 * Route: GET /api/maps/:mapName
 * Fetches the detailed JSON data for a specific map by its name.
 */
router.get('/:mapName', async (req: Request, res: Response) => {
    const mapName = req.params.mapName;
    
    // Validate map name presence
    if (!mapName) {
        return res.status(400).json({ error: 'Map name is required.' });
    }

    console.log(`[Router] Request received for map: ${mapName}`);

    try {
        // Call the service function to get data from the database
        const mapData = await getMapByName(mapName);

        if (mapData) {
            // Success: Return the JSON map data
            return res.status(200).json(mapData);
        } else {
            // Not Found: If the service returned null
            return res.status(404).json({ error: `Map not found with name: ${mapName}` });
        }
    } catch (error) {
        // Handle database or unexpected errors
        console.error('[Router] Server error during map retrieval:', error);
        return res.status(500).json({ 
            error: 'Internal Server Error',
            message: 'Could not fetch map data due to a database issue.' 
        });
    }
});

/**
 * Route: GET /api/maps/
 * Fetches a list of all available map names (currently using the placeholder function).
 * NOTE: The 'req' parameter is prefixed with '_' to satisfy the 'noUnusedParameters' TypeScript rule.
 */
router.get('/', async (_req: Request, res: Response) => {
    try {
        const mapList = await getMapList();
        return res.status(200).json(mapList);
    } catch (error) {
        console.error('[Router] Server error during map list retrieval:', error);
        return res.status(500).json({ 
            error: 'Internal Server Error',
            message: 'Could not fetch map list.' 
        });
    }
});


// Export the router instance so it can be used by server.ts
export default router;
