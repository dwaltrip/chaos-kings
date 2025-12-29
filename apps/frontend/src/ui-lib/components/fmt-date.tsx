const fmtDate = (date: Date): string => {
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const FmtDate = ({ date }: { date: Date }) => <span>{fmtDate(date)}</span>;

export { FmtDate, fmtDate };
