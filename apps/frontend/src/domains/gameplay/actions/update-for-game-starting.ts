import { gameplayPageStore } from '@/domains/gameplay/stores/gameplay-page-store';

function updateForGameStarting(countdownSeconds: number) {
  const { setCountdownActive, setCountdownSeconds } =
    gameplayPageStore.getState().actions;
  setCountdownActive(true);
  setCountdownSeconds(countdownSeconds);
}

export { updateForGameStarting };
