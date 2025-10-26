import { gameMetadataStore } from '@/stores/game-metadata-store';

const { setCountdownActive, setCountdownSeconds } = gameMetadataStore.getState().actions;

function updateForGameStarting(countdownSeconds: number) {
  setCountdownActive(true);
  setCountdownSeconds(countdownSeconds);
}

export { updateForGameStarting };
