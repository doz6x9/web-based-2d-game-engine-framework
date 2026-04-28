import json
import random

def generate_level2_map():
    map_width = 40
    map_height = 40

    # Initialize layers with default walkable terrain (e.g., grass)
    terrain_data = [[0 for _ in range(map_width)] for _ in range(map_height)]
    collision_data = [[0 for _ in range(map_width)] for _ in range(map_height)]

    # --- Create basic layout ---
    # Outer walls
    for i in range(map_width):
        terrain_data[0][i] = 1 # Wall
        terrain_data[map_height - 1][i] = 1 # Wall
        collision_data[0][i] = 1
        collision_data[map_height - 1][i] = 1
    for i in range(map_height):
        terrain_data[i][0] = 1 # Wall
        terrain_data[i][map_width - 1] = 1 # Wall
        collision_data[i][0] = 1
        collision_data[i][map_width - 1] = 1

    # Central open area
    for y in range(5, map_height - 5):
        for x in range(5, map_width - 5):
            terrain_data[y][x] = 0 # Grass

    # Winding path (example)
    for i in range(5, 20):
        terrain_data[i][i] = 2 # Path
        terrain_data[i][i+1] = 2 # Path
        terrain_data[i+1][i] = 2 # Path
    for i in range(20, 30):
        terrain_data[i][map_width - 1 - i] = 2 # Path
        terrain_data[i][map_width - 2 - i] = 2 # Path

    # Water feature
    for y in range(10, 15):
        for x in range(25, 30):
            terrain_data[y][x] = 4 # Water
            collision_data[y][x] = 1 # Water is usually not walkable

    # Cave area
    for y in range(map_height - 10, map_height - 2):
        for x in range(5, 15):
            terrain_data[y][x] = 11 # Cave floor
            if random.random() < 0.2: # Some cave walls
                collision_data[y][x] = 1

    # --- Define Objects ---
    objects = []

    # Player Spawn
    objects.append({
        "type": "SPAWN",
        "x": 2,
        "y": 2
    })

    # NPCs
    objects.append({
        "type": "NPC",
        "id": "friendly_traveler",
        "x": 10,
        "y": 5,
        "sprite": "hero"
    })

    # Enemies
    objects.append({
        "type": "ENEMY",
        "id": "goblin_alpha",
        "x": 15,
        "y": 15,
        "sprite": "goblin",
        "health": 30,
        "attack": 5
    })
    objects.append({
        "type": "ENEMY",
        "id": "goblin_beta",
        "x": 20,
        "y": 10,
        "sprite": "goblin",
        "health": 30,
        "attack": 5
    })
    objects.append({
        "type": "ENEMY",
        "id": "boss_goblin_level2",
        "x": 35,
        "y": 35,
        "sprite": "goblin", # Reusing goblin sprite for now
        "health": 70,
        "attack": 15
    })

    # Items
    objects.append({
        "type": "ITEM",
        "id": "steel_sword",
        "name": "Steel Sword",
        "sprite": "sword",
        "item_type": "WEAPON",
        "x": 8,
        "y": 8
    })
    objects.append({
        "type": "ITEM",
        "id": "health_potion",
        "name": "Health Potion",
        "sprite": "potion",
        "item_type": "CONSUMABLE",
        "x": 12,
        "y": 12
    })
    objects.append({
        "type": "ITEM",
        "id": "mana_potion",
        "name": "Mana Potion",
        "sprite": "mana_potion", # Assuming you have a mana_potion sprite
        "item_type": "CONSUMABLE",
        "x": 13,
        "y": 12
    })
    objects.append({
        "type": "ITEM",
        "id": "silver_key",
        "name": "Silver Key",
        "sprite": "key",
        "item_type": "KEY_ITEM",
        "x": 34,
        "y": 34 # Near the boss goblin
    })

    # Chests
    objects.append({
        "type": "CHEST",
        "id": "chest_level2_1",
        "x": 28,
        "y": 28,
        "sprite": "chest",
        "contents": [
            {"id": "gold_coin", "name": "Gold Coin", "sprite": "mana_potion", "item_type": "GENERIC", "quantity": 5},
            {"id": "health_potion_chest", "name": "Health Potion", "sprite": "potion", "item_type": "CONSUMABLE", "quantity": 1}
        ]
    })

    # Doors
    objects.append({
        "type": "DOOR",
        "id": "locked_door_1",
        "x": 20,
        "y": 20,
        "sprite": "gate",
        "keyId": "silver_key"
    })
    objects.append({
        "type": "DOOR",
        "id": "exit_level2",
        "x": map_width - 2,
        "y": map_height - 1, # Placed on the last row of the map
        "sprite": "gate",
        "requiredEnemyId": "boss_goblin_level2",
        "targetMap": "/maps/level3.json" # Placeholder for next level
    })


    # Update collision data based on objects
    for obj in objects:
        if obj["type"] in ["ENEMY", "CHEST", "DOOR"]:
            # Ensure objects are placed on walkable terrain
            if terrain_data[obj["y"]][obj["x"]] == 1:
                terrain_data[obj["y"]][obj["x"]] = 0 # Make it walkable if it was a wall
            collision_data[obj["y"]][obj["x"]] = 1 # Objects themselves are usually collidable

    map_data = {
        "name": "Level 2: Goblin Caves",
        "width": map_width,
        "height": map_height,
        "layers": [
            {
                "name": "terrain",
                "data": terrain_data
            },
            {
                "name": "collision",
                "data": collision_data
            }
        ],
        "objects": objects
    }

    return map_data

if __name__ == "__main__":
    level2_map_data = generate_level2_map()
    output_path = "E:/web-based-2d-game-engine-frameworkfinal/public/maps/level2.json"
    with open(output_path, "w") as f:
        json.dump(level2_map_data, f, indent=2)
    print(f"Generated {output_path}")