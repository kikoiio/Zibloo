# B2 连续曲面研究 v2

用于判断「连续颈部 + 圆钝 S 形腕足 + 固定腹面色带」是否更接近已选 B2 与 3D 主视觉的一次性原型。保留原有基础模型，未替换计时器主页。

- `geometry.py`：无 Blender 依赖的截面扫掠；逐段运输截面方向，渐变扁圆半径，半球终端与单极点封口。
- `build.py`：Blender 4.5.3 LTS 构建、体素融合根部、松弛平滑、顶点双色、PBR 材质、CPU 棚拍和无 Draco 的 GLB 导出。源控制点保存在脚本中。
- [blender-study.yml](../../../.github/workflows/blender-study.yml)：在独立研究分支触发的云端工作流，2 个 CPU 线程，无本机 GUI/显存占用。

## 验证状态

已通过 Python 语法检查，八条扫掠网格均通过闭合边检查、非退化面检查、向外绕序检查、截面方向无翻转检查。

用户已授权 GitHub Actions 云端执行。[修正版工作流已通过](https://github.com/kikoiio/Zibloo/actions/runs/39794015539)，生成源提交 `cbcbf21c69ec874e803f68a34222923a99dc9caa`。

- Blender 4.5.3 LTS，CPU 2 线程，24 samples，768 × 768。
- 19,232 个三角面；连续外皮 8,000 个顶点。
- 未压缩 GLB 439,304 字节，约 429 KiB，无必需扩展、无需 Draco 解码。
- 实际 GLB 带有 `COLOR_0`，外皮含 1,364 种顶点色值；工作流与下载后的本机检查均通过。
- 第一轮发现腕足色带误映射到头顶，已加距离约束修正。直接检查最终 GLB 中 1,083 个头部顶点，颜色与指定青碧的最大线性通道误差低于 0.000008。
- 已目视检查正面、侧面与主视角，腕足端部闭合圆钝、颈部连续。透明 PNG 的 alpha 范围为 0–255，含透明区域。

这不代表最终美术验收：色带边缘仍有少量网格锯齿，腕足根部和空间层次还可手工精修。浏览器实时加载与动画表现尚未验证，未替换计时器主页。

## 云端输出

工作流成功后，`blender-flow-v2` artifact 包含：

- `zibloo_flow_v2.blend` 和 `zibloo_flow_v2.glb`。
- `hero.png`、`front.png`、`side.png`、`hero-transparent.png`。
- `report.json`，记录实际三角面数、GLB 字节数、Blender 版本和渲染参数。
- `glb-inspection.json`，记录实际导出的顶点色数据。

下载到本机的 [output](output/) 另含 [新旧与参考对照](output/comparison.png)、`review.json`（头部颜色检查、透明通道与文件 SHA256）。第一轮含头顶误色的图片保存在 `review-round1/`，不作为最终预览。

直接查看：[主视角](output/hero.png)、[正面](output/front.png)、[侧面](output/side.png)、[透明图](output/hero-transparent.png)、[Blender 工程](output/zibloo_flow_v2.blend)、[GLB](output/zibloo_flow_v2.glb)。生成文件保留本机与云端 artifact，未额外提交至公开仓库；云端 artifact 保留 7 天。

建议按正面轮廓 → 侧面连接 → 3/4 灯光 → 双色导出检查。模型尚无骨骼和动画；体素融合并减面的网格只用于造型判断，正式动作前需要重拓扑。

研究依据与 Blender 指引见[建模研究记录](../../../docs/brand/3d/blender-workflow-research.md)。
