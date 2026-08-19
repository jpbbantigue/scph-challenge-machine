// Ported from index.html's wrapCanvasText()/renderTicketCanvas()/
// shareTicketImage() — renders the current ticket as a shareable PNG
// (canvas-drawn receipt, same visual language as the on-page ticket) with
// the site URL printed at the bottom as the "link back" since a shared
// image can't carry a real hyperlink on most platforms.
import { Ticket, padTicketNo } from "./roll";

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  });
  if (line) lines.push(line);
  return lines;
}

export function renderTicketCanvas(ticket: Ticket): HTMLCanvasElement {
  const width = 640;
  const padX = 32;
  const missionFont = "italic 17px 'SF Mono', Menlo, ui-monospace, monospace";
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = missionFont;
  const missionLines = wrapCanvasText(ctx, ticket.mission, width - padX * 2);
  const lineHeight = 27;
  const missionH = missionLines.length * lineHeight;
  const height = 74 + missionH + 76;
  canvas.width = width;
  canvas.height = height;

  const r = 14;
  ctx.fillStyle = "#fdfbf3";
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(width, 0, width, height, r);
  ctx.arcTo(width, height, 0, height, r);
  ctx.arcTo(0, height, 0, 0, r);
  ctx.arcTo(0, 0, width, 0, r);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#1a1a1a";
  ctx.font = missionFont;
  ctx.textBaseline = "top";
  missionLines.forEach((line, i) => ctx.fillText(line, padX, 40 + i * lineHeight));

  ctx.fillStyle = "rgba(26,26,26,0.5)";
  ctx.font = "11px 'SF Mono', Menlo, ui-monospace, monospace";
  ctx.fillText(padTicketNo(ticket.no) + " · " + ticket.time, padX, 40 + missionH + 14);

  ctx.strokeStyle = "rgba(26,26,26,0.15)";
  ctx.beginPath();
  ctx.moveTo(padX, height - 42);
  ctx.lineTo(width - padX, height - 42);
  ctx.stroke();

  ctx.fillStyle = "#C68B24";
  ctx.font = "bold 13px 'Space Grotesk', sans-serif";
  const wordmark = "Prompt Royale";
  ctx.fillText(wordmark, padX, height - 28);
  const wordmarkWidth = ctx.measureText(wordmark).width;

  ctx.fillStyle = "rgba(26,26,26,0.55)";
  ctx.font = "12px 'Inter', sans-serif";
  ctx.fillText(
    typeof location !== "undefined" ? location.origin.replace(/^https?:\/\//, "") : "",
    padX + wordmarkWidth + 14,
    height - 28
  );

  return canvas;
}

export async function shareTicketImage(ticket: Ticket): Promise<void> {
  const canvas = renderTicketCanvas(ticket);
  await new Promise<void>((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        resolve();
        return;
      }
      const file = new File([blob], "prompt-royale-receipt.png", { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (data: any) => boolean; share?: (data: any) => Promise<void> };
      const shareData = {
        files: [file],
        title: "Prompt Royale",
        text: ticket.mission + " — made with Prompt Royale",
        url: location.origin
      };
      if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
        try {
          await nav.share(shareData);
          resolve();
          return;
        } catch (e: any) {
          if (e && e.name === "AbortError") {
            resolve();
            return;
          }
          // fall through to download on any other failure
        }
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "prompt-royale-receipt.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      resolve();
    }, "image/png");
  });
}
