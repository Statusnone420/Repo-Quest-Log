import { renderDesktopHtml as renderSharedDesktopHtml, type SurfaceHtmlOptions } from "../web/render.js";
import type { QuestState } from "../engine/types.js";

export function renderDesktopHtml(state: QuestState, options: SurfaceHtmlOptions = {}): string {
  return renderSharedDesktopHtml(state, {
    liveBridge: "desktop",
    ...options,
  });
}
