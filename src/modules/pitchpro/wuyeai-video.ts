/**
 * @deprecated Use lk888-video.ts — kept as re-export shim.
 */
export {
  resolveLk888VideoConfig as resolveWuyeVideoConfig,
  submitLk888Video as submitWuyeVideo,
  submitLk888VideoWithFallback,
  getLk888VideoTask as getWuyeVideoTask,
  downloadLk888VideoContent as downloadWuyeVideoContent,
  isLk888VideoTerminal as isWuyeVideoTerminal,
  isLk888VideoReady as isWuyeVideoReady,
  type Lk888VideoTask as WuyeVideoTask,
  type Lk888VideoStatus as WuyeVideoStatus,
} from './lk888-video';
