function numStr(val: number, pad?: number) {
  return String(val).padStart(pad || 0);
}

function tickForGeneralArmy(army: number): number {
  // works for starting conditions also: army=1 at t=0
  // produce +1 eery even tick: t=2 -> army=2, t=4 -> army=3, etc
  return (army - 1) * 2;
}

export { numStr, tickForGeneralArmy };
