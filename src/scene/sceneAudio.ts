/**
 * Audio tracks contributed by scene audio-input elements.
 *
 * The scene canvas owns the microphone streams; the stream encoder reads the
 * tracks from here so an audio-input element is actually heard on air.
 */

let tracks: MediaStreamTrack[] = [];

export function setSceneAudioTracks(next: MediaStreamTrack[]) {
  tracks = next;
}

export function getSceneAudioTracks(): MediaStreamTrack[] {
  return tracks;
}
