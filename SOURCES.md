# Sources

## Robot geometry and kinematics (verified)
- Repository: https://github.com/unitreerobotics/unitree_ros
- Pinned commit: `deeb607f3a8945a394f53068c28b3a88dde7ff06`
- Files: `robots/g1_description/g1_29dof_mode_15.urdf`, plus the 34 STL meshes it references, and `motor_info.md`.
- Licence: BSD 3-Clause, Copyright (c) 2016-2022 HangZhou YuShu TECHNOLOGY CO.,LTD. ("Unitree Robotics"). The full licence text is shown in the viewer's About panel, as the licence requires for redistribution in binary form.
- Local copy: `source/repo/` (sparse checkout).

## Internal electronics (from the user's INTERNAL_ELECTRONICS_REFERENCE.md and component list)
These facts were taken from the user's reference notes. I have not independently re-checked them against the PDFs:
- RK3588S control board (PC1, 192.168.123.161)
- Jetson Orin NX (PC2, 192.168.123.164)
- MID-360 (192.168.123.20)
- L2 switch with 2× external RJ45
- Battery: 13S, 46.8 V nominal, 9 Ah (Basic teardown)
- I/O outputs: VBAT 58 V/5 A, 24 V/5 A, 12 V/5 A, 12 V/3 A
- XT30 2+2 connectors and 6 MOSFETs on the knee board
- CAN indicated for the motor bus but revision-specific
- Batch-dependent camera host
- Distal capacitor buffers

Their sources:
- China Post Securities teardown (2026-03-30): https://pdf.dfcfw.com/pdf/H3_AP202603311820899944_1.pdf
- QRE G1 overview and I/O: https://docs.quadruped.de/projects/g1/html/g1_overview.html

## Supporting references (descriptions only, no images embedded)
- Weston Robot G1 developer guide: https://docs.westonrobot.com/tutorial/unitree/g1_dev_guide/
- Knee actuator teardown: https://www.china-amass.net/news/deep-dismantling-of-unitree-g1-knee-joint-actuator-full-analysis-of-120-n%C2%B7m-torque-twostage-planetary-reduction-and-dual-encoders/
- Munro Live teardown summary: https://mechafeed.com/blog/unitree-g1-actuator-teardown/

## Libraries
- three.js r147 (MIT): `three.min.js`, `OrbitControls.js`, `RoomEnvironment.js`. They are inlined in the offline file and loaded from jsDelivr in the web version.
- Fonts: Barlow Condensed, IBM Plex Sans, IBM Plex Mono (SIL Open Font Licence). They are inlined in the offline file.

## Rebuild
```
python3 build/pack_g1.py        # URDF + STL -> build/out/g1_data.js (packed meshes + metadata)
python3 build/build_viewer.py   # -> dist/Unitree_G1_Anatomy_Explorer.html and dist/artifact/index.html
node --experimental-websocket build/test_offline.mjs   # offline Chrome test + screenshots
```
