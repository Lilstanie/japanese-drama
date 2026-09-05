/**
 * Media Session — what a car head unit reads.
 *
 * CarPlay and Android Auto do not render the page. They show whatever
 * `navigator.mediaSession.metadata` says and send button presses back through
 * `setActionHandler`. Without this the app is unusable while driving: the
 * screen shows nothing and the steering-wheel controls do nothing.
 *
 * Everything here is feature-detected — Media Session is absent on some
 * browsers, and a missing API must not break playback.
 */

export type MediaSessionHandlers = {
  onPlay: () => void
  onPause: () => void
  /** Advance to the next topic — the natural meaning of "next track" here. */
  onNextTopic: () => void
  /** Restart the current line, for when a sentence was missed. */
  onReplay: () => void
}

const supported = () =>
  typeof navigator !== "undefined" && "mediaSession" in navigator

export function setMediaSessionHandlers(handlers: MediaSessionHandlers): void {
  if (!supported()) return
  const ms = navigator.mediaSession

  // Wrapped individually: a browser that does not know an action throws on
  // setActionHandler, and one unsupported action must not drop the others.
  const set = (action: MediaSessionAction, fn: () => void) => {
    try {
      ms.setActionHandler(action, fn)
    } catch {
      /* action unsupported on this browser */
    }
  }

  set("play", handlers.onPlay)
  set("pause", handlers.onPause)
  set("nexttrack", handlers.onNextTopic)
  // "previoustrack" replays rather than going back a topic: on a drive, the
  // thing you reach for is "say that again", not "rewind ten minutes".
  set("previoustrack", handlers.onReplay)
  set("seekbackward", handlers.onReplay)
}

export function clearMediaSession(): void {
  if (!supported()) return
  const ms = navigator.mediaSession
  for (const action of [
    "play",
    "pause",
    "nexttrack",
    "previoustrack",
    "seekbackward",
  ] as MediaSessionAction[]) {
    try {
      ms.setActionHandler(action, null)
    } catch {
      /* ignore */
    }
  }
  ms.metadata = null
  ms.playbackState = "none"
}

/**
 * Update what the head unit displays.
 *
 * `title` gets the topic and `artist` the speaker, because that is the pairing
 * a car screen shows largest — the topic is what tells you where you are in a
 * rotating playlist.
 */
export function updateMediaSessionMetadata(opts: {
  topicLabel: string
  topicLabelZh: string
  speakerLabel: string
}): void {
  if (!supported() || typeof MediaMetadata === "undefined") return

  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${opts.topicLabel} · ${opts.topicLabelZh}`,
      artist: opts.speakerLabel,
      album: "日本語ドラマ · Podcast",
      artwork: [
        { src: "/logo.png", sizes: "512x512", type: "image/png" },
      ],
    })
  } catch {
    /* metadata is decoration; never let it break playback */
  }
}

export function setMediaSessionPlaybackState(
  state: "playing" | "paused" | "none"
): void {
  if (!supported()) return
  try {
    navigator.mediaSession.playbackState = state
  } catch {
    /* ignore */
  }
}
