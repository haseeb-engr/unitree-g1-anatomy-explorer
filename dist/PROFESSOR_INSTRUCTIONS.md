# Unitree G1 Anatomy Explorer: how to use it in class

## Opening it
1. Copy `Unitree_G1_Anatomy_Explorer.html` (5.8 MB) to the classroom laptop, by USB, email or the course page.
2. Double-click it. It opens in Chrome, Edge or Firefox.
3. No internet, installation or server is needed. Everything is inside the one file.

To open straight into one view, add a tag to the end of the address: `#3d`, `#skeleton` or `#blueprint`.

## The four views
| Key | View | What students see |
|---|---|---|
| 1 | **Real** | The official Unitree G1 meshes with a realistic metal and black finish |
| 2 | **3D** | The same robot coloured by assembly: legs, arms, waist, pelvis, torso, head |
| 3 | **Skeleton** | Kinematics only: a see-through shell over the 29 joint axes. Red, green and blue mean the joint turns about X, Y or Z |
| 4 | **Blueprint** | An engineering X-ray line drawing. It shows an actuator cutaway at every joint (housing, copper windings, rotor, planetary gears, encoder, driver circuit board, hollow shaft), the torso circuit boards and battery cells, the head sensors, and colour-coded wiring: red for power, amber for the joint command bus, magenta for Ethernet and cyan for sensor data. Every module, board and wire can be clicked. Dimensions can be switched on |

**Click any joint or part** to open its info panel. Joint panels show the rotation axis, range, torque and speed limits, motor family, position, and how much robot mass the joint carries. Use the slider or **Sweep range** to move the joint, and the orange arc shows its allowed range.

## Controls
- **Mouse:** drag to rotate, scroll to zoom, right-drag to pan. Touch works on tablets.
- **P:** pose panel with presets (Stand, Wave, Squat, Reach, Walk cycle) and a slider for every joint.
- **L:** joint name labels.
- **T:** turntable.
- **O:** orthographic camera.
- **R:** reset the camera.
- **F:** full screen.
- **Esc:** close a panel.
- **Explode slider** (bottom left): pulls the parts apart. Setting it back to 0% restores the exact assembly.
- **Layer switches** in Skeleton and Blueprint: motor sizes, ankle linkage, wiring and electronics.

## What is exact and what is illustrative
- **Exact, from Unitree's official URDF:** every part shape, joint position, axis, range, torque and speed limit, and link mass. Total mass is 33.7 kg and height is 1323 mm.
- **From Unitree's motor table:** the motor family per joint.
- **Illustrative, marked with \* and a pink "Illustrative" tag:** motor size cylinders, the ankle rods and calf motors, wiring routes, and the electronics boxes. Teardowns show these exist, but their exact geometry is not published.

This is a teaching model, not a manufacturing drawing.

## Tested
- Chrome headless on Linux, opened from `file://` with all network access blocked.
- Loads in about 1.5 s.
- 29 joints present.
- All four views render.
- Joint sliders respect their limits.
- Explode is reversible.
- No console errors.
- No external requests.

Firefox has not been tested yet. Please open the file once in your classroom browser before the lecture.

## Credits
Powered by Fraunhofer IOSB-INA. Developed by muhammad.haseeb@iosb-ina.fraunhofer.de.
