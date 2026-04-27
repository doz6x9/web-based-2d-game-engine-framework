import json

width, height = 60, 40

# Initialize terrain and collision layers (all walls initially)
terrain = [[1 for _ in range(width)] for _ in range(height)]
collision = [[1 for _ in range(width)] for _ in range(height)]

# Helper function to create a room
def create_room(terrain, collision, x_start, x_end, y_start, y_end):
    for y in range(y_start, y_end + 1):
        for x in range(x_start, x_end + 1):
            if 0 <= x < width and 0 <= y < height:
                terrain[y][x] = 2  # Floor
                collision[y][x] = 0  # Walkable

# Helper function to create a corridor
def create_corridor(terrain, collision, x_start, x_end, y_start, y_end):
    for y in range(y_start, y_end + 1):
        for x in range(x_start, x_end + 1):
            if 0 <= x < width and 0 <= y < height:
                terrain[y][x] = 2  # Floor
                collision[y][x] = 0  # Walkable

# Room 1: Starting room with chest (left side)
create_room(terrain, collision, 2, 14, 2, 14)

# Corridor 1: Connection to room 2
create_corridor(terrain, collision, 15, 19, 7, 9)

# Room 2: Middle room with goblin (center)
create_room(terrain, collision, 20, 32, 2, 14)

# Corridor 2: Connection to room 3
create_corridor(terrain, collision, 33, 37, 7, 9)

# Room 3: Final room with gate (right side)
create_room(terrain, collision, 38, 50, 2, 14)

# Large lower chamber for exploration
create_room(terrain, collision, 2, 50, 20, 32)

# Vertical corridors connecting upper to lower
create_corridor(terrain, collision, 8, 10, 15, 19)
create_corridor(terrain, collision, 26, 28, 15, 19)
create_corridor(terrain, collision, 44, 46, 15, 19)

# Build the complete map JSON
map_data = {
    "name": "Mini Quest Demo Map",
    "width": width,
    "height": height,
    "layers": [
        {
            "name": "terrain",
            "data": terrain
        },
        {
            "name": "collision",
            "data": collision
        }
    ]
}

# Save to file
output_path = 'e:/gamedemo/public/maps/test-map.json'
with open(output_path, 'w') as f:
    json.dump(map_data, f, indent=2)

print(f"Map generated successfully!")
print(f"Saved to {output_path}")
print(f"Map dimensions: {width}x{height}")
