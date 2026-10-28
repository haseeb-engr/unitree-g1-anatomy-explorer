/* Teaching text for the G1 viewer. Numbers that come from the URDF are filled in
   by the app at runtime; this file only holds descriptions and source notes. */
window.G1_INFO = {
  // Motor families from unitree_ros/robots/g1_description/motor_info.md
  motorFamilies: {
    '7519-22.5': { effort: 121, velocity: 22.1, size: 'Large', joints: 'hip pitch, hip roll, knee' },
    '7519-14.3': { effort: 77, velocity: 34.9, size: 'Large', joints: 'hip yaw, waist yaw' },
    '6010-32': { effort: 60, velocity: 30.6, size: 'Medium', joints: 'shoulder pitch, waist roll, waist pitch' },
    '5019-16': { effort: 41, velocity: 34.1, size: 'Compact', joints: 'shoulder roll/yaw, elbow, wrist roll, ankle' },
    '5010-16': { effort: 13.4, velocity: 41.5, size: 'Small', joints: 'wrist pitch, wrist yaw' }
  },
  motorOf: {
    hip_pitch: '7519-22.5', hip_roll: '7519-22.5', knee: '7519-22.5',
    hip_yaw: '7519-14.3', waist_yaw: '7519-14.3',
    shoulder_pitch: '6010-32', waist_roll: '6010-32', waist_pitch: '6010-32',
    shoulder_roll: '5019-16', shoulder_yaw: '5019-16', elbow: '5019-16', wrist_roll: '5019-16',
    ankle_pitch: '5019-16', ankle_roll: '5019-16',
    wrist_pitch: '5010-16', wrist_yaw: '5010-16'
  },

  joints: {
    hip_pitch: { title: 'Hip pitch', does: 'Swings the whole leg forward and backward, as when you take a step. It is the first joint in the leg chain, so it carries every joint below it.',
      build: 'A high-torque rotary actuator mounted in the pelvis and upper-thigh assembly.' },
    hip_roll: { title: 'Hip roll', does: 'Moves the leg out to the side and back in. The robot uses it to shift its weight from one foot to the other while balancing.',
      build: 'A second large actuator. In the URDF its frame is tilted by about 10° (0.1749 rad), so its axis is not exactly horizontal.' },
    hip_yaw: { title: 'Hip yaw', does: 'Twists the thigh around its own long axis, which turns the foot in or out. It lets the robot change walking direction.',
      build: 'A large actuator offset forward of the hip, at the top of the thigh.' },
    knee: { title: 'Knee', does: 'Bends and straightens the leg. It does the heaviest work in the body: squatting, standing up and absorbing each footstep.',
      build: 'A large actuator near the knee. Teardowns show a two-stage planetary gearbox, dual encoders and a copper thermal part for cooling.' },
    ankle_pitch: { title: 'Ankle pitch', does: 'Tilts the foot toes-up and toes-down.',
      build: 'This is not a motor at the ankle. Two motors higher up in the calf push and pull connecting rods, and together they produce both ankle pitch and ankle roll. The URDF models the result as two simple serial joints.',
      note: 'Parallel linkage: the URDF does not contain the rods or the real motor positions. The calf motors and rods in Skeleton view are illustrative.' },
    ankle_roll: { title: 'Ankle roll', does: 'Tilts the foot side to side, keeping the sole flat on uneven ground.',
      build: 'Driven by the same two calf motors as ankle pitch. When both rods move together the foot pitches; when they move opposite each other the foot rolls.',
      note: 'Parallel linkage: the URDF does not contain the rods or the real motor positions. The calf motors and rods in Skeleton view are illustrative.' },
    waist_yaw: { title: 'Waist yaw', does: 'Turns the whole upper body left and right on top of the pelvis.',
      build: 'A large actuator stacked directly on the pelvis. Its axis is vertical.' },
    waist_roll: { title: 'Waist roll', does: 'Bends the upper body sideways.',
      build: 'A medium actuator in the low torso. In the URDF its origin is the same point as waist pitch. That is a modelling choice; the two motors do not occupy the same space in the real robot.' },
    waist_pitch: { title: 'Waist pitch', does: 'Bends the upper body forward and backward.',
      build: 'A medium actuator in the low torso, sharing its kinematic origin with waist roll.' },
    shoulder_pitch: { title: 'Shoulder pitch', does: 'Swings the arm forward and backward, like an arm swing while walking.',
      build: 'A medium actuator in the upper torso. Its frame is rolled by 16° (0.2793 rad) in the URDF, so its axis is tilted.' },
    shoulder_roll: { title: 'Shoulder roll', does: 'Lifts the arm out to the side and lowers it again.',
      build: 'A compact actuator just outside the shoulder pitch joint.' },
    shoulder_yaw: { title: 'Shoulder yaw', does: 'Rotates the upper arm around its own length, turning the forearm in or out.',
      build: 'A compact actuator in the upper arm, below the shoulder.' },
    elbow: { title: 'Elbow', does: 'Bends and straightens the arm. In the URDF zero pose the forearm points straight forward, so the elbow is already at 90°.',
      build: 'A compact actuator at the end of the upper arm.' },
    wrist_roll: { title: 'Wrist roll', does: 'Rotates the forearm and hand around the forearm axis, like turning a door handle.',
      build: 'A compact actuator in the forearm.' },
    wrist_pitch: { title: 'Wrist pitch', does: 'Tilts the hand up and down.',
      build: 'A small 5010-class actuator in the distal wrist assembly. Mode 15 uses the 5010 wrist variant.' },
    wrist_yaw: { title: 'Wrist yaw', does: 'Swings the hand side to side.',
      build: 'A small 5010-class actuator. It is the last joint before the hand.' }
  },

  links: {
    pelvis: { title: 'Pelvis', group: 'Pelvis', does: 'The root of the robot. Every coordinate in this model is measured from the pelvis origin. It carries both hip pitch actuators, the waist yaw actuator and the pelvis IMU.' },
    hip_pitch_link: { title: 'Hip pitch housing', group: 'Leg', does: 'Connects hip pitch to hip roll. It is the first part that moves when the leg swings.' },
    hip_roll_link: { title: 'Hip roll housing', group: 'Leg', does: 'Connects hip roll to hip yaw. It holds the leg out at the correct hip width.' },
    hip_yaw_link: { title: 'Thigh', group: 'Leg', does: 'The upper leg structure from hip yaw down to the knee actuator.' },
    knee_link: { title: 'Calf', group: 'Leg', does: 'The lower leg from knee to ankle. The two ankle drive motors and their connecting rods are housed here.' },
    ankle_pitch_link: { title: 'Ankle cross (gimbal)', group: 'Leg', does: 'A small intermediate part, the centre of the Cardan-style ankle joint. It weighs only 74 g.' },
    ankle_roll_link: { title: 'Foot', group: 'Leg', does: 'The rigid foot and sole. The ankle axis is about 35 mm above the sole contact plane.' },
    waist_yaw_link: { title: 'Waist yaw stage', group: 'Waist', does: 'The rotating stage on top of the pelvis that turns the upper body.' },
    waist_roll_link: { title: 'Waist roll stage', group: 'Waist', does: 'A small intermediate part between waist roll and waist pitch.' },
    torso_link: { title: 'Torso', group: 'Torso', does: 'The main load-bearing body. It houses the rear battery, the locomotion computer, the optional development computer (EDU), power distribution, cooling and the torso IMU.' },
    head_link: { title: 'Head', group: 'Head', does: 'Fixed to the torso; the standard G1 has no neck motors. It carries the depth camera, the 3D LiDAR, a microphone array and a speaker.' },
    logo_link: { title: 'Chest logo plate', group: 'Torso', does: 'A cosmetic part on the torso front.' },
    shoulder_pitch_link: { title: 'Shoulder housing', group: 'Arm', does: 'Connects shoulder pitch to shoulder roll.' },
    shoulder_roll_link: { title: 'Upper shoulder', group: 'Arm', does: 'Connects shoulder roll to shoulder yaw.' },
    shoulder_yaw_link: { title: 'Upper arm', group: 'Arm', does: 'The upper arm structure from shoulder yaw to the elbow.' },
    elbow_link: { title: 'Elbow housing', group: 'Arm', does: 'Connects the elbow to the forearm.' },
    wrist_roll_link: { title: 'Forearm', group: 'Arm', does: 'The forearm structure carrying the wrist actuators.' },
    wrist_pitch_link: { title: 'Wrist housing', group: 'Arm', does: 'Between wrist pitch and wrist yaw.' },
    wrist_yaw_link: { title: 'Hand mount', group: 'Arm', does: 'The flange where a hand attaches.' },
    rubber_hand: { title: 'Rubber hand', group: 'Arm', does: 'The passive hand on this configuration. Dexterous hands are separate, optional products with their own motors. For example, the Unitree Dex3-1 has 7 active degrees of freedom (thumb 3, index 2, middle 2), runs on 12\u201358 V and has 9 tactile sensor arrays.' }
  },

  sensors: {
    d435_link: { title: 'Depth camera (Intel RealSense D435i)', does: 'A stereo depth camera in the head. It sees colour and distance, so the robot can find objects and obstacles in front of it. Its USB cable goes to PC1 on earlier production batches and to the EDU development computer (PC2) on newer batches.', note: 'The frame is pitched down by about 48° in the URDF, so the camera looks toward the floor ahead.' },
    mid360_link: { title: '3D LiDAR (Livox MID-360)', does: 'Spins laser beams to build a 360° point cloud of the surroundings, used for mapping and navigation. It sits on the internal Ethernet network at 192.168.123.20. Field of view: 360° horizontal, up to 59° vertical.', note: 'Mounted upside down in the URDF (rolled 180°) at the top of the head.' },
    imu_in_torso: { title: 'Torso IMU', note: 'Position: high confidence (official URDF frame). Board shape: illustrative; the URDF has no board geometry.', does: 'An inertial measurement unit: accelerometers and gyroscopes that measure how the upper body tilts and turns. Balance control depends on it.' },
    imu_in_pelvis: { title: 'Pelvis IMU', note: 'Position: high confidence (official URDF frame). Board shape: illustrative; the URDF has no board geometry.', does: 'A second IMU in the pelvis that measures the motion of the lower body directly.' }
  },

  boards: {
    battery: { title: 'Battery pack', refs: ['cps', 'qre'],
      does: 'A removable lithium-ion pack, reached from the back of the torso, powers the whole robot. A teardown of a G1 Basic reports 13 cells in series (13S), 46.8 V nominal, 9 Ah, about 0.42 kWh. The drawing shows one cylinder per series group.',
      note: 'Figures are from the Basic teardown; the EDU pack may differ. Cell arrangement and pack size here are illustrative.' },
    bms: { title: 'Battery management board', refs: [],
      does: 'Watches cell voltages and temperatures, balances the cells and switches the pack on and off safely.',
      note: 'Every lithium pack needs one. Its location in the G1 is not published, so it is drawn next to the pack.' },
    power: { title: 'Power distribution board', refs: ['cps'],
      does: 'Splits battery power into feeds for the internal motor DC bus of each limb, and into supplies for the computers and sensors.',
      note: 'Teardown photos show power-distribution wiring. Board shape is schematic. Internal voltage rails are not published, and the external port ratings (see I/O panel) are not the same thing as internal rails.' },
    loco: { title: 'Locomotion computer (RK3588S, PC1)', refs: ['g1d', 'cps', 'weston'],
      conf: 'Identity: high (teardown photo). Dimensions: reconstructed.',
      does: 'Unitree calls this the Motion-Control Computing Unit. It is reserved for Unitree’s own control program and is not open to developers. It is the operation and control board in the rear torso, built around a Rockchip RK3588S. It runs the walking and balance controller, reads both IMUs and every joint encoder, and sends commands over the low-level motor buses. On the internal network it is 192.168.123.161. A fan and finned heatsink cool it.',
      note: 'Identity confirmed by teardown photos (China Post Securities report, pp. 26–28). Dimensions and layout are reconstructed.' },
    dev: { title: 'Development computer (Jetson Orin NX, PC2)', refs: ['g1d', 'weston', 'cps'],
      does: 'EDU only. Unitree calls this the Development Computing Unit, and it is the computer developers are allowed to program. An NVIDIA Jetson Orin NX 16 GB on a custom carrier board runs the user’s own software: vision, AI and planning. On the internal network it is 192.168.123.164. The copper block stands for its thermal parts.',
      rows: [['Module', 'NVIDIA Jetson Orin NX 16 GB'], ['CPU', '8-core Arm Cortex-A78AE, up to 2 GHz'], ['GPU', '1024-core NVIDIA Ampere, 32 Tensor Cores, up to 918 MHz'], ['AI performance', '100 TOPS'], ['Memory', '16 GB'], ['Login', 'user unitree, address 192.168.123.164']],
      note: 'EDU only. Placement is approximate.' },
    switch: { title: 'Internal Ethernet switch', refs: ['weston'],
      conf: 'Logical topology: documented. Location: unknown.',
      does: 'A Layer-2 switch that joins PC1 (192.168.123.161), PC2 (192.168.123.164), the MID-360 LiDAR (192.168.123.20) and the external RJ45 port at the neck. This network is separate from the motor buses: no Ethernet goes to the joints.',
      note: 'Logical connections are documented. Physical location is unknown. Each computer also has its own Ethernet debug port on the back, with standard RJ45 wiring (pins 1\u20138: orange-white, orange, green-white, green, blue-white, blue, brown-white, brown).' },
    io: { title: 'I/O panel and external ports', refs: ['g1d', 'qre'],
      rows: [['1 · XT30UPB-F', 'VBAT, 58 V / 5 A, wired straight to the battery'], ['2 · XT30UPB-F', '24 V / 5 A output'], ['3 · XT30UPB-F', '12 V / 5 A output'],
        ['4, 5 · RJ45', 'Gigabit Ethernet (1000BASE-T)'], ['6, 7, 8 · USB-C', 'USB 3.0 host, 5 V / 1.5 A'], ['9 · USB-C Alt Mode', 'USB 3.2 host and DisplayPort 1.4'],
        ['10 · I/O OUT', '12 V / 3 A, plus 6 GPIO from the Jetson: UART1 TX/RX (pins 203/205), I2C2 SCL/SDA (232/234), GPIO (128/130)']],
      does: 'The service panel at the upper back of the neck. A laptop can join the robot’s internal network through the RJ45 ports, and accessories can draw power and data from the other connectors. The full connector table from Unitree’s developer guide is below.', conf: 'Interfaces: documented by Unitree (G1-D developer guide, which shares the G1 connector set; QRE G1 docs list the same). Board shape: illustrative.',
      note: 'These are ratings of accessory output connectors. 58 V is not the battery’s nominal voltage, and the outputs do not describe the internal DC/DC rails. Port labels follow the published pinout; panel position and board are illustrative.' },
    caps: { title: 'Distal capacitor buffer', refs: ['cps'],
      conf: 'Medium. Seen on a Basic unit; do not assume the same count and location on every 29-DOF EDU limb.',
      does: 'A bank of capacitors near the end of a long limb cable. It supplies the short current bursts a motor needs, so the voltage does not dip at the far end of the harness.',
      note: 'The teardown describes such buffers at some distal joint supplies (pp. 37–38). The number and location on the 29-DOF EDU are not verified; one teaching example is drawn per limb.' },
    headmcu: { title: 'Head controller board', refs: ['cps'],
      does: 'A small board in the head that handles head wiring and communication for the audio and sensor parts.',
      note: 'The securities teardown mentions a head MCU and communication wiring. The exact board, model and pinout are not independently confirmed.' },
    mic: { title: 'Microphone array', refs: ['weston'],
      does: 'Several microphones on one board let the robot hear speech and estimate where a sound comes from.',
      note: 'Documented in the head. Board shape and position are illustrative.' },
    speaker: { title: 'Speaker', refs: ['weston'], does: 'Plays sounds and speech.', note: 'Documented in the head. Position is illustrative.' }
  },

  module: {
    official: 'Unitree states that its self-developed joint motors reach up to 120 N·m, use a hollow shaft to stay light and compact, and carry dual encoders for precise position and velocity feedback.',
    intro: 'Each G1 joint is driven by a self-contained actuator module: motor, gearbox, position sensors and its own driver circuit board, all in one housing. Cables pass through the hollow centre so the joint can turn without twisting them.',
    parts: [
      ['housing', 'Housing and output flange', 'The aluminium case. The bolt circle on the output face fastens to the next part of the limb.'],
      ['copper', 'Stator windings', 'Copper coils. The driver board switches current through them to make a rotating magnetic field.'],
      ['rotor', 'Rotor with magnets', 'Permanent magnets on the rotor follow the field. This is a permanent-magnet synchronous motor (PMSM).'],
      ['gear', 'Planetary gearbox', 'A sun gear and three planet gears trade speed for torque. Teardowns of the knee show two such stages.'],
      ['pcb', 'Driver circuit board (FOC)', 'A circular board at each joint. A local microcontroller runs field-oriented control; MOSFETs form the 3-phase inverter that drives the coils (the knee teardown counts 6); current shunts measure motor current; ceramic capacitors steady the DC bus. The microcontroller model is obscured in the teardown, and boards may differ between motor families.'],
      ['xt30', 'Two XT30 2+2 connectors', 'Each connector carries the power pair and the data pair. One brings the harness in and one passes it on, so drivers along a limb can be chained.'],
      ['encoder', 'Encoders', 'Measure the exact shaft angle. Teardowns report dual encoders, on the motor side and the output side.'],
      ['shaft', 'Hollow shaft', 'An open centre for the power and data cables of the joints further along the limb.']
    ],
    ankle: 'This is one of the two ankle motors in the calf. They drive the foot through push rods, so ankle pitch and ankle roll come from both motors working together.'
  },

  wireTypes: {
    power: { title: 'Power', colour: '#ff6b5a', refs: ['cps'], does: 'Carries high-current DC from the battery, through the distribution board, to every motor driver and computer.' },
    bus: { title: 'Low-level motor bus', colour: '#ffd060', refs: ['amass', 'cps'], does: 'A differential signal pair, run with the motor DC bus through the hollow joint shafts. It carries commands from the locomotion computer to each driver board and returns joint angles, currents and temperatures. Knee boards have two XT30 2+2 connectors, so drivers along a limb can be chained.', note: 'Low-level differential motor bus: CAN is indicated in the March 2026 teardown report (CAN-H/CAN-L labels). The September 2026 knee teardown shows A/B + SIG labels but cannot confirm the protocol for that unit. It is revision-specific. The physical route is uncertain.' },
    eth: { title: 'Ethernet', colour: '#e98cff', refs: ['weston'], does: 'The internal Layer-2 network: PC1 192.168.123.161, PC2 192.168.123.164, MID-360 192.168.123.20 and the external RJ45 port. It is separate from the low-level motor buses.' },
    data: { title: 'Sensor data', colour: '#5fe0ff', refs: ['weston'], does: 'Carries camera, IMU and audio data to the computer that processes it.' }
  },

  wiring: {
    title: 'Wiring harness (illustrative)',
    does: 'Power and communication cables run from the torso through the hollow centres of the joints to each motor driver. Teardowns show connectors on both sides of joint driver boards, so the motors in a limb can be daisy-chained.',
    note: 'The real routes, wire gauges and bus topology (CAN or RS-485) are not published. These dashed lines only show which parts are connected.'
  },

  actuatorStack: ['Housing and mounting flange', 'Circular motor-driver board (FOC control)', 'Stator windings and rotor (permanent-magnet synchronous motor)', 'Planetary reduction gearbox', 'Output bearing and flange', 'Position encoders (dual)', 'Hollow centre for cables'],

  refs: {
    urdf: ['Unitree URDF g1_29dof_mode_15', 'https://github.com/unitreerobotics/unitree_ros/blob/master/robots/g1_description/g1_29dof_mode_15.urdf'],
    weston: ['Weston Robot G1 developer guide', 'https://docs.westonrobot.com/tutorial/unitree/g1_dev_guide/'],
    qre: ['QRE G1 overview and I/O', 'https://docs.quadruped.de/projects/g1/html/g1_overview.html'],
    cps: ['China Post Securities G1 teardown (2026-03-30)', 'https://pdf.dfcfw.com/pdf/H3_AP202603311820899944_1.pdf'],
    g1d: ['Unitree G1-D SDK Developer Guide', 'https://support.unitree.com/home/en/G1D_Developer'],
    amass: ['AMASS knee actuator teardown (2026-09-05)', 'https://www.china-amass.net/news/deep-dismantling-of-unitree-g1-knee-joint-actuator-full-analysis-of-120-n%C2%B7m-torque-twostage-planetary-reduction-and-dual-encoders/']
  },

  sources: [
    ['Official URDF and meshes, unitree_ros (BSD-3-Clause)', 'https://github.com/unitreerobotics/unitree_ros/tree/master/robots/g1_description'],
    ['Motor family table, motor_info.md', 'https://github.com/unitreerobotics/unitree_ros/blob/master/robots/g1_description/motor_info.md'],
    ['Weston Robot G1 developer guide', 'https://docs.westonrobot.com/tutorial/unitree/g1_dev_guide/'],
    ['Unitree G1-D SDK Developer Guide (shared G1 joint order, connectors, PC2)', 'https://support.unitree.com/home/en/G1D_Developer'],
    ['QRE G1 overview and I/O pinout', 'https://docs.quadruped.de/projects/g1/html/g1_overview.html'],
    ['China Post Securities G1 teardown report, 2026-03-30 (PDF)', 'https://pdf.dfcfw.com/pdf/H3_AP202603311820899944_1.pdf'],
    ['Knee actuator teardown (china-amass)', 'https://www.china-amass.net/news/deep-dismantling-of-unitree-g1-knee-joint-actuator-full-analysis-of-120-n%C2%B7m-torque-twostage-planetary-reduction-and-dual-encoders/'],
    ['Munro Live actuator teardown summary', 'https://mechafeed.com/blog/unitree-g1-actuator-teardown/']
  ],

  license: 'Copyright (c) 2016-2022 HangZhou YuShu TECHNOLOGY CO.,LTD. ("Unitree Robotics"). All rights reserved.\n\nRedistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:\n\n* Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.\n\n* Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.\n\n* Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.\n\nTHIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.'
};
