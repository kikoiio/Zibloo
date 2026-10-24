# Blender 建模研究与本项目应用

研究日期：2026-10-22。目标是继续 B2/C3 的 3D 造型原型，先确认形体，再做连续动作。

## 查阅的指引

1. [Blender Studio：Stylized Character Workflow](https://studio.blender.org/training/stylized-character-workflow/)
   — Julien Kaspar 的官方角色流程，覆盖目标与参考、基础形、平面与轮廓、平滑、表情测试、重拓扑、UV、材质和呈现。课程基于 Blender 2.8，适合借鉴流程，不能直接照搬界面或新版节点参数。本次阅读的是公开课程介绍和章节目录，没有声称看完订阅视频。
2. [Blender 手册：Subdivision Surface](https://docs.blender.org/manual/en/4.5/modeling/modifiers/generate/subdivision_surface.html)
   — 简单低面数控制笼通过细分获得有机曲面；Smooth Shading 只改法线，不能修复切口和连接。高细分显著增加 RAM/显存，视口应保持低等级。[实际读取的官方手册源码](https://projects.blender.org/blender/blender-manual/raw/branch/main/manual/modeling/modifiers/generate/subdivision_surface.rst)。HTML 文档访问返回 403，因此改读官方源文件；主分支内容可能随新版更新。
3. [Khronos glTF Blender 导出器文档源码](https://github.com/KhronosGroup/glTF-Blender-IO/blob/main/docs/blender_docs/scene_gltf2.rst)
   — 导出器识别指定的 PBR 节点组合，不会把任意程序化节点网络完整搬进浏览器。面积光和 World 灯光也不会随 GLB 原样导出。透射等扩展要求运行时支持；Blender 渲染与网页效果必须分别验收。导出参数另外核对了本机 Blender 4.5.3 自带的 `io_scene_gltf2` 源码。

## 现有资产的实际问题

对照 `zibloo_3d_base.png`、`build_zibloo.py` 和已选主视觉：

| 问题 | 代码原因 | 本轮处理 |
| --- | --- | --- |
| 腕足尖端像切断的管子 | 真正调用的是 Bezier bevel + fill caps，终点半径仍为起点约 82%；未调用的 `add_tube_mesh()` 不影响现有渲染 | 渐变截面 + 半球纬圈 + 单个极点封口 |
| 根部拼接、部分根端外露 | 头和腕足是独立相交物体，头底收缩过快 | 独立研究中用体素融合和平滑验证连续外皮 |
| 腕足粗管感、动势近似 | 圆截面、沿程粗细变化很少 | 扁圆截面，主腕足长 S 弯，其余后置重叠 |
| 薄荷色不稳定 | `Geometry.Normal → Separate XYZ → ColorRamp` 按世界 Z 决定分色；并非固定的腹部标记，也不属于可靠的 glTF 材质组合 | 运输局部截面方向，计算薄荷色带并写入顶点色 `BellyColor` |
| 光珠和高光易压过造型 | 高发光与较强棚灯让材质判断困难 | 降低发光；同一灯光输出正面、侧面和主视角 |

三视图是生成式视觉参考，包含吸盘等与文字规范冲突的细节，不能据此推断真实拓扑或绑定结构。继续服从已选方向：无吸盘、无嘴眉、不凑齐八条可见腕足、无紫色。

另已直接读取当前 96,392 字节的基础 GLB：腕足材质 `Tentacle_DualTone_NormalBlend` 没有导出 base color factor/texture，网格中也没有 `COLOR_0`。因此这不是单纯的潜在兼容性问题；基础 GLB 实际没有携带原节点生成的双色数据，新研究会对导出文件中的 `COLOR_0` 做独立检查。

## 适合 Zibloo 的 Blender 操作顺序

1. **参考与相机**：导入 B2、主视觉和姿态图作参考平面。先锁正交正面、侧面与 3/4 机位，确保角色高度约四成多为主要头部体量。参考图各视角不一致的部位由设计判断统一，不能自动描图拼接。
2. **低模大形**：头部保留饱满上部和收拢颈部。主腕足先做两三条连续 S 弯，其余在后景交叠。用灰模检查轮廓、负空间、根部与光珠接触，暂不依赖漂亮材质。
3. **连续连接**：造型探索可用体素融合获得无缝连接，但融合后的三角面不是最终动画拓扑。正式绑定前，重拓扑为沿腕足延伸的四边面环；颈环与腕足分叉保留足够面环，避免在最大弯曲处集中极点。
4. **截面和末端**：以扁圆截面形成丝带感，沿程缓慢收细；终端用弧形纬圈闭合，保留圆钝体量。检查侧面，避免所有弯曲仅发生在同一个平面。
5. **双色与材质**：分色固定在局部腹侧，允许随扭转露出。原型用顶点色，正式低模可按需要改为 UV 色带贴图。精确把 sRGB 色值转为线性值；非金属、粗糙度约 0.44、小量 SSS。先验收中性灯下的颜色，再调整棚拍灯。
6. **动作验证**：造型通过后再做颈部控制和每条腕足的骨链/Spline IK，先观察弯曲与扭转是否保体积。随后制作 Idle、Greeting、Focus、Celebrate。不要在尚未确定的融合网格上投入完整绑定。
7. **分开交付**：`.blend` 留存灯光、SSS 和原始工程；透明 PNG/WebP 用于低开销原型展示；GLB 只承诺已验证的几何、顶点色与 PBR。先检查未压缩 GLB 的颜色和轮廓，再评估 Draco 的体积收益与解码成本。

## 本轮可复现研究

[blender-flow-v2](../../../prototype/scratch/blender-flow-v2/README.md) 是独立造型研究，不覆盖原始 `.blend`、PNG、GLB，也不代表用户批准了新的角色形象。

已准备生成脚本、几何检查与独立分支上的 GitHub Actions 工作流，用户已明确授权云端渲染；实际结果与验证状态见研究目录 README。

修正版[云端运行通过](https://github.com/kikoiio/Zibloo/actions/runs/39794015539)：19,232 三角面、429 KiB 未压缩 GLB、四张评审渲染。实际 GLB 包含双色顶点数据，并对头部误色修正做了独立检查。该网格仍是静态造型研究，色带边缘、根部分叉和侧面空间层次需要后续精修，尚未开始正式绑定。

## v3：把指引用于可变形原型

[动作研究 v3](../../../prototype/scratch/blender-flow-v3/README.md)在 v2 基础上验证了“低面控制笼 → 蒙皮变形 → 一级细分 → 烘焙导出”的顺序。实际控制笼为 4,506 个四边面，75 根骨骼驱动八条腕足及头部、光珠。源曲线路径保留在隐藏集合 `EDITABLE_Source_Forms`，可在 Blender 中继续调整。

两项变形修正对这个角色有效：骨段使用相对静止朝向的最小旋转，避免腕足经过竖直方向时翻滚；权重按网格点到腕足路径线段的连续投影计算，再平滑分配给相邻骨段，避免最近采样点造成的阶梯式权重和腕部褶皱。它们改善了原型，但不能替代根部分叉的人工拓扑和权重整理。

[云端建模与浏览器验证](https://github.com/kikoiio/Zibloo/actions/runs/39808231587)完成四个动作的实际蒙皮与循环检查。GLB 保留 `COLOR_0`，通过关键帧重采样与 Meshopt 从 2,408,016 字节缩减到 756,548 字节。Blender 渲染与网页截图分别评审；网页灯光和材质仍有差异，不能以离线棚拍代替网页验收。

## v4：统一网页与 Blender 的变形顺序

[连接与变形研究 v4](../../../prototype/scratch/blender-flow-v4/README.md)先细分静止控制笼，再在最终表面上重采样远端权重、统一限制四个影响，供 Blender 与 GLB 共同使用。颈部权重在局部面邻接关系上平滑；低于颈部的腕足不再因截面半径判断而残留躯干影响。应用修改器后重新查找骨骼组索引，避免复用旧 RNA 引用；导出前逐顶点检查影响数量与权重和。

[最终云端运行](https://github.com/kikoiio/Zibloo/actions/runs/40046469602)通过后又分别查看了棚拍、网页和手机截图。96 个点在四个采样姿态中的 Blender／网页最大位置差为约 0.00185 个模型单位。量化网格的静止位置比较需要恢复逆绑定矩阵中的解码变换，不能直接比较量化坐标。最终 GLB 为 789,692 字节；低面控制笼为 4,982 面，依然属于自动生成的研究拓扑。
