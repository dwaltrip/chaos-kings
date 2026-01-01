import { useParams } from 'react-router';

function BestStartPlayPage() {
  const { puzzleId } = useParams();
  console.log('puzzle id:', puzzleId);
  return <BestStartPlayPageContent></BestStartPlayPageContent>;
}

function BestStartPlayPageContent() {
  return <div className="best-start-play-page">Best Start Play Page</div>;
}

export { BestStartPlayPage };
