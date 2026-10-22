# Zibloo Blender 3D 基础资产

这一目录以 `docs/brand/3D-character-guidelines.md` 和 `docs/brand/selected-direction.md` 为准，独立于旧的 `prototype/scratch/p0-v2` 程序化 WebGL 角色。

当前产物：

- `zibloo_3d_base.blend`：Blender 4.5.3 LTS 工程文件。
- `zibloo_3d_base.glb`：可由 Three.js / glTF loader 使用的角色模型，包含头部、眼睛、双色腕足和光珠；已启用 Draco 压缩，当前约 144KB。
- `zibloo_3d_base.png`：基础待机/英雄姿态的棚拍预览。
- `build_zibloo.py`：可重复生成工程、渲染图和 glTF 的 Blender Python 脚本。

本版已经落实：

- 水滴/卵圆形外套膜，不使用球形大头。
- 小型竖直胶囊眼和克制象牙高光，无嘴、无眉、无吸盘。
- 8 条不均匀放射的 S 形腕足，前景腕足承担主要轮廓，其余腕足形成层次遮挡。
- 深青碧外背与浅薄荷内侧的双色逻辑。
- 软胶/细腻黏土材质、三点柔光和环境遮蔽感。
- 右侧腕足托举发光光珠，作为后续 Focus 姿态的结构基础。

后续工作顺序建议：先审阅 `zibloo_3d_base.png` 的轮廓和比例，再在同一工程中加入 Idle、Greeting、Focus、Celebrate 四个姿态，并按网页端需求进一步压缩 glTF 体积。

网页接入 Draco 版 glTF 时需要给 Three.js 配置 `DRACOLoader`；如果首版不想引入解码器，也可以在脚本中关闭 Draco 导出，得到约 919KB 的普通 GLB。

MCP 当前不是必需项：模型、材质、渲染和 glTF 导出都由本地 Blender Python API 完成。只有需要在线资产库、外部生成服务或远程 Blender 控制时，才再引入 MCP。

## 2026-10-22：继续造型研究

当前预览可见腕足平切末端和根部拼接；现有程序化双色也需要检查 glTF 兼容性。尚不能视为已通过造型验收的模型。原有基础文件保留，新的[连续曲面研究 v2](../../../prototype/scratch/blender-flow-v2/README.md)单独进行；[Blender 指引与问题分析](blender-workflow-research.md)记录了来源、建模顺序和导出边界。

## 四边面与动作原型 v3

后续评审请查看[动作研究 v3](../../../prototype/scratch/blender-flow-v3/README.md)：连续外皮、4,506 面自动四边面控制笼、75 根骨骼，以及 Idle、Greeting、Focus、Celebrate 四个循环动作。云端建模、渲染和浏览器加载检查已完成，优化后带动作的 GLB 为约 739 KiB，使用 Meshopt 解码。该原型保留可编辑源形体和未压缩 GLB，未覆盖本目录的历史基础文件。

这仍是造型与动作评审资产。正式制作需要人工整理腕足根部面环、局部权重和动画控制器；当前网页材质也不能等同于 Blender 的灯光与 SSS 效果。
