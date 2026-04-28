import json
import random
import math

# Tile IDs
GRASS = 0
WALL = 1       # Cave Cliff / Rock Wall
WATER = 2
SAND = 3
PATH = 4
STONE = 5
SWAMP = 10
FOREST = 11

def paint_blob(terrain, collision, cx, cy, radius, tile_type, is_solid):
    height = len(terrain)
    width = len(terrain[0])
    for y in range(max(0, cy - radius - 2), min(height, cy + radius + 3)):
        for x in range(max(0, cx - radius - 2), min(width, cx + radius + 3)):
            dist = math.hypot(x - cx, y - cy)
            noisy_radius = radius + random.uniform(-1.5, 1.5)
            if dist < noisy_radius:
                terrain[y][x] = tile_type
                collision[y][x] = 1 if is_solid else 0

def get_random_walkable(collision, width, height, min_y=0, max_y=None):
    """Finds a safe, open tile. Guaranteed to return a valid location."""
    if max_y is None: max_y = height

    for _ in range(200):
        x = random.randint(2, width - 3)
        y = random.randint(min_y, max_y - 1)
        if collision[y][x] == 0:
            return x, y

    # Exhaustive fallback if random fails
    for y in range(min_y, max_y):
        for x in range(2, width - 2):
            if collision[y][x] == 0:
                return x, y

    return width // 2, min_y

def generate_level(level_name, width, height, num_enemies, num_chests, scale_multiplier, filename, next_level_file):
    terrain = [[GRASS for _ in range(width)] for _ in range(height)]
    collision = [[0 for _ in range(width)] for _ in range(height)]

    # 1. Paint Forests (CLUSTERED IN ONE REGION)
    # Pick a random quadrant for the dense forest to live in
    forest_center_x = random.choice([width // 4, 3 * width // 4, 2 * width // 3])
    forest_center_y = random.choice([height // 3, 3 * height // 2])

    for _ in range(6 * scale_multiplier):
        # Add some scatter, but keep it tightly clustered around the chosen center
        cx = forest_center_x + random.randint(-12, 12)
        cy = forest_center_y + random.randint(-12, 12)

        # Ensure it stays within map boundaries
        cx = max(5, min(width - 5, cx))
        cy = max(5, min(height - 5, cy))

        # Dense, large radius
        radius = random.randint(2, 3)
        paint_blob(terrain, collision, cx, cy, radius, FOREST, True)

    # 2. Paint Lakes
    for _ in range(2 * scale_multiplier):
        cx, cy = random.randint(10, width - 10), random.randint(10, height - 10)
        radius = random.randint(3, 5)
        paint_blob(terrain, collision, cx, cy, radius + 1, SAND, False)
        paint_blob(terrain, collision, cx, cy, radius, WATER, True)

    # 3. Paint Swamps (REDUCED MUD)
    for _ in range(1 * scale_multiplier): # Down to just 1 patch
        cx, cy = random.randint(5, width - 5), random.randint(5, height - 5)
        radius = random.randint(2, 4) # Smaller radius
        paint_blob(terrain, collision, cx, cy, radius, SWAMP, False)

    # 4. Winding path (Guarantees a walkable route through anything)
    path_x = width // 2
    for y in range(height - 1, 0, -1):
        if random.random() < 0.3: path_x += random.choice([-1, 1])
        path_x = max(2, min(width - 3, path_x))
        terrain[y][path_x] = PATH
        collision[y][path_x] = 0
        terrain[y][path_x+1] = PATH
        collision[y][path_x+1] = 0

    # 5. Cave Cliff Borders
    for y in range(height):
        for x in range(width):
            if x < 2 or x >= width - 2 or y < 2 or y >= height - 2:
                terrain[y][x] = WALL
                collision[y][x] = 1

    objects = []

    # Spawn Player & Guide
    spawn_x, spawn_y = width // 2, height - 4
    objects.append({"type": "SPAWN", "x": spawn_x, "y": spawn_y})

    if scale_multiplier == 1:
        objects.append({"type": "NPC", "id": "guide", "x": spawn_x + 2, "y": spawn_y, "sprite": "hero"})

    # Enemies
    for i in range(num_enemies):
        ex, ey = get_random_walkable(collision, width, height)
        objects.append({"type": "ENEMY", "id": f"goblin_{i}", "x": ex, "y": ey, "sprite": "goblin", "health": 30, "attack": 5})

    # Chests
    for i in range(num_chests):
        lx, ly = get_random_walkable(collision, width, height)
        objects.append({"type": "CHEST", "id": f"chest_{i}", "x": lx, "y": ly, "sprite": "chest"})

    # Boss Key (Guaranteed placement in bottom half)
    key_x, key_y = get_random_walkable(collision, width, height, min_y=height//2)
    objects.append({"type": "ITEM", "id": "boss_key", "name": "Boss Key", "sprite": "key", "item_type": "KEY_ITEM", "x": key_x, "y": key_y})

    # Boss & Door (Guaranteed placement in top half)
    boss_x, boss_y = get_random_walkable(collision, width, height, min_y=3, max_y=10)
    objects.append({"type": "DOOR", "id": "level_exit", "x": boss_x, "y": boss_y - 1, "sprite": "gate", "keyId": "boss_key", "requiredEnemyId": "boss_goblin", "targetMap": next_level_file})
    objects.append({"type": "ENEMY", "id": "boss_goblin", "x": boss_x, "y": boss_y, "sprite": "goblin", "health": 50 * scale_multiplier, "attack": 20})

    map_data = {
        "name": level_name,
        "width": width, "height": height,
        "layers": [
            {
                "name": "terrain",
                "data": terrain
            },
            {
                "name": "collision",
                "data": collision
            }
        ],
        "objects": objects
    }

    with open(filename, 'w') as f:
        json.dump(map_data, f, indent=2)
    print(f"Generated {level_name}: saved to {filename}")

if __name__ == "__main__":
    generate_level("Level 1: The Wilds", 40, 40, 1, 4, 1, 'public/maps/test-map.json', '/maps/level2.json')
    generate_level("Level 2: The Deep Woods", 80, 80, 2, 8, 2, 'public/maps/level2.json', 'victory_screen')