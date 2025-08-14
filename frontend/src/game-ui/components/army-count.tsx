interface ArmyCountProps {
  count: number;
}

function ArmyCount({ count }: ArmyCountProps) {
  return <span className="army-count">{count}</span>;
}

export { ArmyCount };
