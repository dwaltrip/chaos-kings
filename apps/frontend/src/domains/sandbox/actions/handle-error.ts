function handleError(message: string, code?: string): void {
  console.error(`[Sandbox Error] ${code ? `[${code}] ` : ''}${message}`);
}

export { handleError };
