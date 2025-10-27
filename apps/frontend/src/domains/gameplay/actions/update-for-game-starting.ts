import { gameMetadataStore } from '@/domains/gameplay/stores/game-metadata-store';

function updateForGameStarting(countdownSeconds: number) {
  const { setCountdownActive, setCountdownSeconds } =
    gameMetadataStore.getState().actions;
  setCountdownActive(true);
  setCountdownSeconds(countdownSeconds);
}

export { updateForGameStarting };
