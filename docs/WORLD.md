# The building, city and sound

This is the source of truth for what the player sees and hears around the game: the 3D building, its controls, the crew, the city, music and graphics quality.
None of it changes the simulation or the save.
Visual and interaction conventions are in [UI_DESIGN.md](UI_DESIGN.md), and where models and textures come from is in [ASSET_PIPELINE.md](ASSET_PIPELINE.md).

## Building and camera

The game opens on the 99.99% home screen in front of an isometric startup building of two floors joined by a glass elevator.
The server floor holds the server hall, the network and power room, the monitoring room, a cooling plant, a workshop and the stores.
The office floor above is laid out in zones, each with a floor of its own and its name floating over it: open desks, quiet desks, a huddle room, engineering, a meeting room, reception, an events space with a stage, a library, a kitchen and dining area, a lounge, a games room, a foosball corner and a glass nap room.

| Input | Effect |
| --- | --- |
| Drag | Pan |
| Scroll or pinch | Zoom |
| Click equipment | Inspect it |
| `Shift` + drag, right-drag or two fingers | Rotate and tilt |
| `Q` / `E` | Turn 45 degrees |
| House button | Reset the view |
| Floor menu, `Page Up` / `Page Down`, or clicking the elevator | Ride between floors |
| `P` | Pause or resume |
| `Esc` | Close a view |

Choosing equipment from a panel takes the view to its floor, and a floor out of view that needs the player shows a badge.
Walls between the camera and the room drop out of the way.

Address parameters help with screenshots and testing: `?floor=office` opens on the office floor, `?time=0.5` fixes the time of day (0.5 is noon), and `?graphics=hd` or `?graphics=basic` forces a detail level.

## Walking and views

**Walk** beside the camera buttons walks the building as the player's avatar, one of 18 cube animals from Kenney's CC0 [Cube Pets](https://kenney.nl/assets/cube-pets).
The avatar is chosen from the chip beside the account on the home screen or the menu's Avatar tab, and can be changed at any time.
`W` `A` `S` `D` or the arrow keys walk relative to the view, `Shift` runs, and a click or tap on the floor walks there; clicking equipment also walks over to it.
What is within reach shows as a button: `Space` or a tap inspects equipment, rides the elevator, or plays with the office's fun things, each with its own show — a coffee steams and ends up in the avatar's hand, a snack drops out of the vending machine, the cooler glugs as a cup fills, scores pop over the arcade cabinets while their screens race, and a nap lies the avatar down in a pod with z's drifting out of its hood. The prompt sweeps for as long as each lasts.
Glass doors slide open as the avatar comes near, footsteps sound off the floor, and the crew wait for it to pass.
`Esc` stops walking, and when not walking the avatar sits in the founder's chair in the meeting room.

View mode, or `V`, also sees the building from the avatar.

- **First person** looks through its eyes under the ceiling's lights.
  A run opens here until the player chooses a view; a guide or a `?floor=` link opens from above instead.
- **Follow** puts the camera a few metres behind the avatar, and scrolling comes closer.

Both views take the mouse, as in a game: moving it looks around, and in first person the centre dot is where a left click walks or inspects.
`Esc` only gives the cursor back, with a card to look around again or exit.
A dialog or a guide's card gives the cursor back by itself, while an inspection's reading does not: the next left click puts it away.
Where the browser will not hand over the mouse, moving it towards an edge turns the view, and the hint at the top has Exit.
On a touch screen, drag to look around.
The menu's Controls tab sets the look speed, inverts looking up and down and sets the field of view (70 to 90 degrees).
Both views turn walk mode on, and stopping the walk returns to the overview.

The round map in the room's corner turns with the view and is centred on the avatar while it walks.
It shows the floor in view with each zone in its own colour, the crew and any incident, with a badge waiting on the rim when it lies beyond the edge.
A line under it says where the avatar is, its tabs change floor, and in walk mode a click on it walks there.
Its close button hides it, and on a phone it starts folded.
The menu's Map tab shows the full plan of both floors, with search, layers and Show in room.

## Crew

The office is staffed by animated monsters from Quaternius's CC0 [Ultimate Monsters](https://quaternius.com/packs/ultimatemonsters.html) pack, one species per role.

| Species | Role |
| --- | --- |
| Cats and birds | Write the code |
| Yeti | On call, watching the monitoring wall |
| Monkey | Runs the meetings |
| Mushroom | Crunches data |
| Chick | Intern |
| Ninja | Security |
| Frog | Fixes hardware |
| Bunny | Reception |
| Bee | Marketing |

They walk, idle, nod and wave with the pack's own animations, and shake their heads during an incident.
Six of them wander on seeded loops, stopping at the vending machines, the coffee machine, the water cooler, a colleague's desk, the whiteboard or the window.
Small groups stand chatting with speech bubbles that turn to the outage during an incident.
A frog and a bunny keep a ping-pong rally going, a ninja and a cat play foosball, and someone dozes in a nap pod.
When an incident starts, two engineers ride down from their desks to the racks.
Visitors also wander between rooms and use the elevator on their own errands, with fewer of them at Low quality or on software rendering.

The elevator has a fitted car, guide rails, ropes, a counterweight and a travelling cable.
From the avatar, a ride runs its course inside the car; overview rides can be hurried without jumping, and reduced motion cuts straight to arrival.
Between visitor errands the car returns to the displayed floor and rests four seconds.
A player ride takes priority, and visitors never send the car away with the avatar inside or at its doors.

Licences are in `frontend/public/models/creatures/`.

## City and daylight

The office is the top floor of a six-storey glass campus building in a Silicon Valley suburb, with the "99.99%" sign on the storey below it, a palm lawn and its own car park.
Around it is a grid of palm-lined boulevards with planted medians, lamps, zebra crossings, pedestrians and traffic, including robotaxis, that takes turns at the junctions.
The blocks hold office parks, neighbourhoods of houses with back-yard pools, strips of shops with billboards for made-up startups, a park with a fountain and a ring-shaped headquarters round a wooded courtyard.
Nothing tall ever stands between the camera and the crew, and the city fades into the sky with distance, so it has no edge.

A whole day passes in twelve minutes of play: the sun crosses the sky, the light warms toward evening, and after dark the moon takes over while offices, lamps and headlights come on.
The office keeps its own steady light.

| Concern | Source |
| --- | --- |
| City layout | `frontend/src/components/scene/city.ts` |
| Day cycle | `frontend/src/components/scene/sky.ts` |
| Trees, vehicles, pedestrians | `treeModels.ts`, `vehicleModels.ts`, `walkerModels.ts` in the same folder |
| Desk computers, vending machines, cooling units and other bespoke props | `frontend/src/components/scene/propModels.ts` |
| Furniture packs | [Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit) and [KayKit Furniture Bits](https://kaylousberg.itch.io/furniture-bits), licences in `frontend/public/models/` |

## Sound

The game has its own music, written as notes in `frontend/src/game/score.ts` and synthesised in the browser with the Web Audio API: a mellow groove while building and a tense loop during incidents.
It starts when the player presses Play.
The speaker button beside Menu mutes it, and Menu > Sound has separate Music and Sound effects volumes; the setting is shared by both modes and remembered.

Zoomed in, each zone can be heard quietly: foosball clacks, arcade bleeps, the espresso machine and the sleeper's breathing (`frontend/src/components/scene/zoneSounds.ts`).
The elevator clicks, hums, chimes and slides its doors, and on the server floor the city gives way to the hall's fans.

## Graphics quality

On a machine with a graphics card the room draws in HD: photo-scanned CC0 floors and walls from [Poly Haven](https://polyhaven.com) and [ambientCG](https://ambientcg.com), photo-scanned Poly Haven furniture and plants, physically based materials, soft reflections and shadows, ambient occlusion and a glow on screens and lights.
At HD the city's ground, roofs, walls and trees also carry photo textures, windows reflect the street and sky, and cars have glossy paint.
Without a GPU the room keeps a lighter pixel look and never downloads the HD assets.

Menu > Graphics offers Auto (the default), High, Medium and Low.
Medium keeps the HD look without the glow and ambient shading, and Low is the flat pixel look with no shadows, fewer pixels and 30 frames a second.
The choice is remembered in the browser; the per-level details are in [UI_DESIGN.md](UI_DESIGN.md).
Texture credits are in `frontend/public/textures/License.txt` and `frontend/public/models/polyhaven/License.txt`.
