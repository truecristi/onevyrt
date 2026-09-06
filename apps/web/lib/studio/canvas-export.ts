import type { Node, Edge } from "@xyflow/react";
import type { RFNodeData } from "../funnel-map";
import { KIND_COLOR } from "../studio-ui";

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

/** Draws the funnel directly from node/edge state onto an offscreen canvas —
 *  deliberately not a screenshot of the live DOM, so it can't inherit any of
 *  html-to-image's cloning/serialization failure modes. A clean diagram, not
 *  a pixel-for-pixel mirror of the card styling. */
export function renderFunnelToPng(nodes: Node[], edges: Edge[], scale = 2): string {
  const NODE_H = 64;
  const PAD = 50;
  const widthOf = (n: Node) => (typeof (n.data as RFNodeData).w === "number" ? ((n.data as RFNodeData).w as number) : 132);

  const minX = Math.min(...nodes.map((n) => n.position.x));
  const minY = Math.min(...nodes.map((n) => n.position.y));
  const maxX = Math.max(...nodes.map((n) => n.position.x + widthOf(n)));
  const maxY = Math.max(...nodes.map((n) => n.position.y)) + NODE_H;
  const width = maxX - minX + PAD * 2;
  const height = maxY - minY + PAD * 2;
  const ox = PAD - minX, oy = PAD - minY;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1.6;
  for (const e of edges) {
    const s = nodes.find((n) => n.id === e.source);
    const t = nodes.find((n) => n.id === e.target);
    if (!s || !t) continue;
    const isYes = e.sourceHandle === "yes", isNo = e.sourceHandle === "no";
    const sy = s.position.y + oy + (isYes ? NODE_H * 0.38 : isNo ? NODE_H * 0.68 : NODE_H / 2);
    const sx = s.position.x + widthOf(s) + ox;
    const tx = t.position.x + ox;
    const ty = t.position.y + oy + NODE_H / 2;
    const midX = (sx + tx) / 2;
    ctx.strokeStyle = isYes ? "#22c55e" : isNo ? "#f43f5e" : "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.bezierCurveTo(midX, sy, midX, ty, tx, ty);
    ctx.stroke();
    const angle = Math.atan2(ty - sy, tx - midX);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - 8 * Math.cos(angle - 0.4), ty - 8 * Math.sin(angle - 0.4));
    ctx.lineTo(tx - 8 * Math.cos(angle + 0.4), ty - 8 * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fill();
  }

  for (const n of nodes) {
    const d = n.data as RFNodeData;
    const w = widthOf(n);
    const x = n.position.x + ox, y = n.position.y + oy;
    const color = KIND_COLOR[d.kind] ?? "#64748b";
    ctx.fillStyle = "#ffffff";
    roundRectPath(ctx, x, y, w, NODE_H, 10);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, x, y, w, NODE_H, 10);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.fillRect(x, y, 4, NODE_H);

    ctx.fillStyle = "#0f172a";
    ctx.font = "600 12px system-ui, Arial, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(truncateText(ctx, d.label ?? n.id, w - 20), x + 12, y + 10);

    ctx.fillStyle = color;
    ctx.font = "700 9px system-ui, Arial, sans-serif";
    ctx.fillText(d.kind.toUpperCase(), x + 12, y + NODE_H - 20);
  }

  return canvas.toDataURL("image/png");
}
