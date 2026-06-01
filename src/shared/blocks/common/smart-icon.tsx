import type { ComponentPropsWithoutRef, ComponentType } from 'react';
import {
  Activity,
  BookOpenText,
  Box,
  Brain,
  Coins,
  CreditCard,
  DollarSign,
  FileText,
  Folder,
  HelpCircle,
  History,
  Home,
  Key,
  Mail,
  MessageCircle,
  Newspaper,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  Zap,
} from 'lucide-react';
import {
  RiBarChart2Line,
  RiChat2Line,
  RiClapperboardAiLine,
  RiCloudy2Fill,
  RiCloudyFill,
  RiCodeFill,
  RiDatabase2Line,
  RiDiscordFill,
  RiFlashlightFill,
  RiGithubFill,
  RiImage2Line,
  RiKey2Fill,
  RiKeyLine,
  RiMessage2Line,
  RiMusic2Line,
  RiNextjsFill,
  RiQuestionLine,
  RiRobot2Line,
  RiTaskLine,
  RiTwitterXFill,
} from 'react-icons/ri';

type IconProps = ComponentPropsWithoutRef<'svg'> & { size?: number | string };

const ICONS: Record<string, ComponentType<IconProps>> = {
  Activity,
  BookOpenText,
  Box,
  Brain,
  Coins,
  CreditCard,
  DollarSign,
  FileText,
  Folder,
  Github: RiGithubFill,
  History,
  Home,
  Key,
  Mail,
  MessageCircle,
  Newspaper,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  Zap,

  RiBarChart2Line,
  RiChat2Line,
  RiClapperboardAiLine,
  RiCloudy2Fill,
  RiCloudyFill,
  RiCodeFill,
  RiDatabase2Line,
  RiDiscordFill,
  RiFlashlightFill,
  RiImage2Line,
  RiKey2Fill,
  RiKeyLine,
  RiMessage2Line,
  RiMusic2Line,
  RiNextjsFill,
  RiRobot2Line,
  RiTaskLine,
  RiTwitterXFill,
};

export function SmartIcon({
  name,
  size = 24,
  className,
  ...props
}: { name: string; size?: number; className?: string } & Omit<
  IconProps,
  'size' | 'className'
>) {
  const IconComponent =
    ICONS[name] ?? (name.startsWith('Ri') ? RiQuestionLine : HelpCircle);

  return <IconComponent size={size} className={className} {...props} />;
}
