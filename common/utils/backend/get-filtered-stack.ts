function getFilteredStack(label?: string) {
  const stack = new Error().stack;
  if (!stack) {
    console.log('-------------------------');
    console.log('No stack trace available!');
    console.log('-------------------------');
    return;
  }
  const lines = stack.split('\n');

  // Filter out node_modules and built-in Node.js modules
  const filtered = lines.filter(
    (line) =>
      !line.includes('node_modules') &&
      !line.includes('internal/') &&
      !line.includes('(node:'),
  );

  console.log(
    ['======= Filtered Stack Trace', label ? `[${label}]` : '', '======='].join(
      ' ',
    ),
  );
  console.log(filtered.join('\n'));
}

export { getFilteredStack };
