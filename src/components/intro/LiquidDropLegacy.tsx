import type { CSSProperties } from 'react'

/**
 * V1 回退版本：单层圆形 backdrop-filter 放大镜。
 * 当前页面不再使用，但按项目约定保留，不删除，方便后续快速对比或恢复。
 */
export function LiquidDropLegacy({ progress }: { progress: number }) {
  const size = 210 - progress * 136
  return (
    <div
      aria-hidden="true"
      className="liquid-drop-legacy"
      style={{
        width: size,
        height: size,
        transform: `translate3d(-50%, ${180 - progress * 360}px, 0)`,
      } as CSSProperties}
    />
  )
}
