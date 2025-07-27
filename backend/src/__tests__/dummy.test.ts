describe('Dummy Test Suite', () => {
  test('should perform basic math operations', () => {
    expect(2 + 2).toBe(4);
    expect(10 - 5).toBe(5);
    expect(3 * 4).toBe(12);
  });

  test('should handle string operations', () => {
    const greeting = 'Hello';
    const name = 'World';
    expect(`${greeting} ${name}`).toBe('Hello World');
  });

  test('should work with arrays', () => {
    const numbers = [1, 2, 3];
    expect(numbers.length).toBe(3);
    expect(numbers.includes(2)).toBe(true);
  });
});