import { Composition } from 'remotion';
import { PancakeReel, TOTAL } from './PancakeReel';

export const Root = () => <>
  <Composition id="PancakeAz" component={PancakeReel} durationInFrames={TOTAL} fps={30} width={1080} height={1920} defaultProps={{ lang: 'az' as const }} />
</>;
