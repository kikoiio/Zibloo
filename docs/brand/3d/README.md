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

## 触手连接与变形精修 v4

最新评审使用[连接与变形研究 v4](../../../prototype/scratch/blender-flow-v4/README.md)。它增加腕足厚度，局部平顺根部，保留低面控制笼，并让 Blender 与网页使用相同的细分静止表面和四影响蒙皮。最终云端检查及目视复核已完成，GLB 约 771 KiB；评审页支持正、侧、背面与 v3 对比。背面颈部过渡及正式人工拓扑仍待处理。

## 立体体积研究 v5

针对侧面仍偏扁的问题，最新查看[体积研究 v5](../../../prototype/scratch/blender-flow-v5/README.md)。头部同区域实测厚度增加约 38%，触手向前后错开后整体前后跨度增加约 54%，正面宽度基本保持。相同机位的 90° 侧面对比保留在输出目录；托珠动作采用连续传输的截面方向，修复前腕的局部翻转。

[云端运行](https://github.com/kikoiio/Zibloo/actions/runs/40048894899)与下载后目视复核完成，四组动作及网页检查通过，GLB 约 756 KiB。推荐以 v5 继续评审体积；人工根部拓扑、局部权重与最终材质仍待正式制作。

## 灵动与变色研究 v6

最新查看[灵动与变色 v6](../../../prototype/scratch/blender-flow-v6/README.md)：触手中后段收细、主腕足拉长，12 段骨链驱动逐段传递且彼此错开的弯曲；保留饱满的侧面体积。默认青碧以外，新增沙色、赤褐、墨棕与局部渐变演示；[章鱼颜色资料](octopus-color-research.md)区分物种证据和风格化配色。

[最终云端检查](https://github.com/kikoiio/Zibloo/actions/runs/40051440950)及目视复核完成，四动作、配色与渐变交互、侧面及手机检查通过。GLB 约 975 KiB，包含基础青碧与四组动作；动态变色由评审页驱动，Blender 工程另有 `skin_stage` 可编辑控制。该版本继续作为造型与运动原型评审。

## 眼神与大幅动作研究 v7

v6 的技术验证未解决活动度与表情的体验问题。继续查看[眼神与动作研究 v7](../../../prototype/scratch/blender-flow-v7/README.md)：主腕足重新设计抬举与展开姿势，逐段积分弯曲保持腕足长度，并以视线、眨眼、眯眼、闭合笑眼表达四种状态。预览页提供眼神特写和动作进度条；保留 v6 的立体体积与四种变色实验。[云端模型渲染](https://github.com/kikoiio/Zibloo/actions/runs/40053382966)与[最终网页检查](https://github.com/kikoiio/Zibloo/actions/runs/40054301740)通过；四组动作帧、眼神与侧面已目视复核。GLB 约 896 KiB，眼神包含在 GLB 的四组动作中。实际测量、原型边界与视觉观察见该原型说明。
