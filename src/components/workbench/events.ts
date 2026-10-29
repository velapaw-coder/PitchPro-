export const PROJECTS_CHANGED = 'pitchpro:projects-changed';
export const ASSETS_CHANGED = 'pitchpro:assets-changed';

export function emitProjectsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PROJECTS_CHANGED));
  }
}

export function emitAssetsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ASSETS_CHANGED));
  }
}

export const LONG_IMAGES_GENERATING = 'pitchpro:long-images-generating';
export const DESIGNS_GENERATING = 'pitchpro:designs-generating';

export function emitLongImagesGenerating(generating: boolean) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(LONG_IMAGES_GENERATING, { detail: { generating } })
    );
  }
}

export function emitDesignsGenerating(generating: boolean) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(DESIGNS_GENERATING, { detail: { generating } })
    );
  }
}

export const VIDEO_GENERATING = 'pitchpro:video-generating';

export function emitVideoGenerating(generating: boolean) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(VIDEO_GENERATING, { detail: { generating } })
    );
  }
}

export const FOCUS_PROPOSAL_CHAT = 'pitchpro:focus-proposal-chat';

export function emitFocusProposalChat() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FOCUS_PROPOSAL_CHAT));
  }
}
