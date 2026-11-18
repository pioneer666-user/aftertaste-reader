# D012 Research

- **Decision** 采用 D004 的 Vue Flow 1.48.2、显式成员、由坐标和节点实际尺寸求组框。**Rationale** 实验已真实验证缩放下拖动、组和读写恢复。**Alternatives considered** 自研画布需另实现指针和缩放，嵌套父子节点会将层级与布局绑定。
- **Decision** 沿用 D009 已发布完整图，缺图或解析失败时停止布局协调。**Rationale** `apply-graph` 以显式 remove 删除并原子发布完整新图。**Alternatives considered** 解析临时文件或通过 Git 工作区猜删除会误删合法布局。
- **Decision** 布局单文件、同服务串行修订比较、图快照比较、同目录原子发布。**Rationale** 两个标签页不能覆盖已确认的新布局，失败后仍可重试原请求。**Alternatives considered** 浏览器站点存储会随访问入口或上下文变化，盲写文件会接受旧标签页。
- **Decision** 主动重排时按组和独立节点确定性网格摆放，回到初始视野。**Rationale** 保留 D004 简单保组约定，环和自环无需特殊排序。**Alternatives considered** 拓扑排序对有环图还需额外约定，自动重排会打扰已有排布。
