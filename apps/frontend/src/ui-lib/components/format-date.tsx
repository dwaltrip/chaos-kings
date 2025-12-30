const fmtDate = (date: Date): string => {
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: '2-digit',
  });
};

const FmtDate = ({ date }: { date: Date }) => <span>{fmtDate(date)}</span>;

export { FmtDate, fmtDate };
