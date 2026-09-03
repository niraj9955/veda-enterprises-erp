// ─── voice-active-controller ────────────────────────────────────────────────
//
// A SHARED singleton that ensures only ONE SpeechRecognition session is
// active at any time across the whole app.
//
// Why: Browsers (Chrome/Edge) only allow ONE active SpeechRecognition session
// at a time. If two components start a session simultaneously (e.g., a
// per-field mic + the AI chat mic), Chrome silently kills one of them. This
// is the #1 cause of "mic doesn't work everywhere".
//
// Solution: every voice input component (VoiceInput, FieldVoiceInput) asks
// this controller for permission to start. If another component is currently
// listening, it is force-stopped first.

type StopFn = () => void

class ActiveVoiceController {
  private currentStop: StopFn | null = null
  private currentId: string | null = null

  /**
   * Register a new listener. If another component is currently listening,
   * it will be force-stopped first via the stop function it registered.
   *
   * @param id       unique id of the caller (instance id)
   * @param stopFn   function to call when ANOTHER caller asks to take over
   *                 (used to gracefully stop THIS caller)
   * @returns always true
   */
  takeOver(id: string, stopFn: StopFn): boolean {
    if (this.currentId && this.currentId !== id && this.currentStop) {
      // Stop whoever is currently listening
      try {
        this.currentStop()
      } catch {
        // ignore
      }
    }
    this.currentId = id
    this.currentStop = stopFn
    return true
  }

  /**
   * Release the slot if we still own it. Safe to call even if we don't.
   */
  release(id: string) {
    if (this.currentId === id) {
      this.currentId = null
      this.currentStop = null
    }
  }

  /**
   * Force-stop whoever is listening. Used on dialog close / unmount /
   * route change.
   */
  stopAll() {
    if (this.currentStop) {
      try {
        this.currentStop()
      } catch {
        // ignore
      }
    }
    this.currentId = null
    this.currentStop = null
  }

  /** True if any voice input is currently active. */
  get isActive(): boolean {
    return this.currentId !== null
  }
}

// Single shared instance
export const activeVoiceControllerLike = new ActiveVoiceController()

/** Convenience: stop any active voice input. */
export function stopAllVoiceInputs() {
  activeVoiceControllerLike.stopAll()
}
