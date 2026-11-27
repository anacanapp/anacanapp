import { useAppSetting } from '@/hooks/useAppSettings';
import { tr } from '@/lib/tr';
import MommyHeroClassic, { MommyHeroProps } from './MommyHeroClassic';
import MommyHeroAurora from './MommyHeroAurora';
import MommyHeroStorybook from './MommyHeroStorybook';
import MommyHeroPolaroid from './MommyHeroPolaroid';
import MommyHeroMinimalCard from './MommyHeroMinimalCard';
import MommyHeroMesh from './MommyHeroMesh';
import MommyHeroStory from './MommyHeroStory';
import MommyHeroBento from './MommyHeroBento';

export type MommyHeroVariant =
  | 'classic'
  | 'aurora'
  | 'storybook'
  | 'polaroid'
  | 'minimal'
  | 'mesh'
  | 'story'
  | 'bento';

const VARIANTS: MommyHeroVariant[] = [
  'classic', 'aurora', 'storybook', 'polaroid', 'minimal', 'mesh', 'story', 'bento',
];

/**
 * Reads the selected variant from app_settings.mommy_hero_variant
 * (admin-controlled via Tənzimləmələr → Mommy Hero) and renders that variant.
 * Defaults to "classic" so existing users see no change until the admin switches.
 */
const MommyHero = (props: MommyHeroProps) => {
  const variantSetting = useAppSetting('mommy_hero_variant');
  const variant: MommyHeroVariant = VARIANTS.includes(variantSetting as MommyHeroVariant)
    ? (variantSetting as MommyHeroVariant)
    : 'classic';

  switch (variant) {
    case 'aurora':    return <MommyHeroAurora {...props} />;
    case 'storybook': return <MommyHeroStorybook {...props} />;
    case 'polaroid':  return <MommyHeroPolaroid {...props} />;
    case 'minimal':   return <MommyHeroMinimalCard {...props} />;
    case 'mesh':      return <MommyHeroMesh {...props} />;
    case 'story':     return <MommyHeroStory {...props} />;
    case 'bento':     return <MommyHeroBento {...props} />;
    default:          return <MommyHeroClassic {...props} />;
  }
};

export default MommyHero;
