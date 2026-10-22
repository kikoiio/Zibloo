# B2 连续曲面研究 v2

用于判断「连续颈部 + 圆钝 S 形腕足 + 固定腹面色带」是否更接近已选 B2 与 3D 主视觉的一次性原型。保留原有基础模型，未替换计时器主页。

- `geometry.py`：无 Blender 依赖的截面扫掠；逐段运输截面方向，渐变扁圆半径，半球终端与单极点封口。
- `build.py`：Blender 4.5.3 LTS 构建、体素融合根部、松弛平滑、顶点双色、PBR 材质、CPU 棚拍和无 Draco 的 GLB 导出。源控制点保存在脚本中。
- [blender-study.yml](../../../.github/workflows/blender-study.yml)：在独立研究分支触发的云端工作流，2 个 CPU 线程，无本机 GUI/显存占用。

## 验证状态

已通过 Python 语法检查，八条扫掠网格均通过闭合边检查、非退化面检查、向外绕序检查、截面方向无翻转检查。

用户已授权 GitHub Actions 云端执行。尚未完成 Blender 构建、渲染或 GLB 运行时验收，不能把上述几何检查当作视觉通过。

## 云端输出

工作流成功后，`blender-flow-v2` artifact 包含：

- `zibloo_flow_v2.blend` 和 `zibloo_flow_v2.glb`。
- `hero.png`、`front.png`、`side.png`、`hero-transparent.png`。
- `report.json`，记录实际三角面数、GLB 字节数、Blender 版本和渲染参数。

建议按正面轮廓 → 侧面连接 → 3/4 灯光 → 双色导出检查。模型尚无骨骼和动画；体素融合并减面的网格只用于造型判断，正式动作前需要重拓扑。

研究依据与 Blender 指引见[建模研究记录](../../../docs/brand/3d/blender-workflow-research.md)。
