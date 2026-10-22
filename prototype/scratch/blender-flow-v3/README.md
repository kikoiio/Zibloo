# Zibloo 四边面与动作研究 v3

继续 v2 的连续外皮，精修背景腕足深度、根部融合与色带过渡，推进可编辑网格和四组动作。这是独立原型，不覆盖 v2 工程和现有计时器主页。

## 本轮内容

- 保留 `EDITABLE_Source_Forms` 集合：八条 Bezier 路径、腕足源网格与头部源形体；默认隐藏，Blender 中可展开检查。
- 体素融合后用 QuadriFlow 生成 4,506 面、4,508 顶点的四边面控制笼，骨骼变形后再做一级细分，得到 18,026 顶点的连续外皮。
- Root、Head、Orb 和每条腕足九段独立变形骨骼。曲线路径驱动采样变换并烘焙，不依赖浏览器支持 Blender 的 IK 约束。
- Idle、Greeting、Focus、Celebrate 四个可循环动作。Focus 的两条前腕向光珠下方收拢；Greeting 由一条主腕招手，其余维持轻缓伴随运动。
- `.blend`、带蒙皮和动作的 `.glb`、四张姿态图、侧面、透明图、四个 GIF 和独立交互评审页。

QuadriFlow 是自动生成的初始控制笼，不等同于经过动画师手工整理的生产拓扑。独立变形骨骼是可复现的动作原型，也不是已完成的艺术家控制器绑定。正式复杂动作前仍需整理分叉面环和控制器。

## 验证

生成与重型验证使用已获授权的 GitHub Actions，Blender CPU 两线程执行完毕后再启动一个云端 Chromium，避免重型任务重叠。本机不启动 Blender、浏览器自动化或安装这些依赖。

工作流检查四边面比例、蒙皮权重归一化、姿态顶点有限值和异常膨胀；浏览器实际加载 GLB，核对四个动作、蒙皮顶点变化、循环首尾差、双色数据、切换按钮、手机布局和减少动态效果。

2026-10-22 的[建模与渲染运行](https://github.com/kikoiio/Zibloo/actions/runs/39808231587)已完成全部步骤，源提交为 `7ece03c`。实际结果：75 根骨骼、零非流形边、权重归一化最大误差 `2.22e-16`。浏览器加载的是优化后的模型，四个动作都有实际蒙皮变形，采样循环首尾距离最大约 `0.000019`，暂停后切换四个动作的姿态误差均为零，无页面脚本异常。

GLB 从 2,408,016 字节压缩至 756,548 字节（约 739 KiB，减少 68.6%），保留四个动作及双色顶点属性。主 GLB 使用 `EXT_meshopt_compression`，接入 Three.js 时需要 `MeshoptDecoder`；`zibloo_flow_v3_source.glb` 是不依赖该压缩扩展的原始导出备份。

已检查 Focus 正面、侧面、Celebrate 及四组动作的分段预览。连续投影与平滑骨权重改善了前腕弯曲的分段褶皱。当前适合验证轮廓、动作语义和网页加载；根部分叉仍有自动重拓扑造成的起伏，侧面偏薄，网页材质与 Blender 棚拍也存在差异。推荐保留本轮动作方案，再由人工整理根部面环和局部权重后推进正式资产。

[最终预览打包与检查](https://github.com/kikoiio/Zibloo/actions/runs/39809370228)已通过（`fc5bfdb`）。补齐了页面标点和动态提示的字体覆盖，并按屏幕比例调整相机距离；390 px 手机宽度下逐一检查了四个姿态的屏幕范围，避免横向裁切。

## 查看与复现

下载后的 `output/` 包含独立评审页、模型、四个 GIF、姿态图和三个 JSON 报告，生成产物不提交到公开仓库。

- `index.html`：旋转模型、切换动作、暂停及下载工程；需要通过 HTTP 打开。
- `poses.jpg`、`focus-side.png`：姿态总览与侧面；`idle.gif`、`greeting.gif`、`focus.gif`、`celebrate.gif`：循环预览。
- `zibloo_flow_v3.blend`：保留源形体、控制笼、变形骨骼和动作的 Blender 4.5.3 LTS 工程。
- `report.json`、`optimization.json`、`browser-inspection.json`：几何、压缩和浏览器检查的实际数据。

完整重建使用 `.github/workflows/blender-animation-study.yml`。只改预览页时，使用 `.github/workflows/blender-pack-review.yml` 的 `source_run` 输入复用既有云端渲染，避免重复启动 Blender。完整模型必须从原始 GLB 重新优化，脚本会保留已有 `_source.glb`。
