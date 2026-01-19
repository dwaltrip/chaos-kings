if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('scan')) {
  const { scan } = await import('react-scan');
  scan({
    log: true,
  });
}
