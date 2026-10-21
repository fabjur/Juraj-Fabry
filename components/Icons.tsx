
import React from 'react';
import {
  Image,
  Github,
  Loader2,
  AlertTriangle,
  BarChart,
  Upload,
  Tag,
  Home,
  CalendarDays,
  UserCircle,
  Layers, 
  Users,
  Folder,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Store, 
  Download,
  FileBarChart,
  Map,
  Clock,
  Menu,
  SlidersHorizontal,
  PieChart,
  Trash2,
  Key,
  Archive,
  ShieldAlert,
  BookOpen,
  X, 
  Save,
  FolderOpen,
  Edit,
  ArrowLeft,
  Table,
  ClipboardList, 
  Search,
  RotateCw, 
  Lightbulb, 
  Eye, 
  Sparkles, 
  CircleX, 
  CircleCheck, 
  Filter, 
  Calculator, 
  ClipboardCopy, 
  ArrowUp, 
  ArrowDown, 
  Flame, 
  FileText, 
  Cpu, 
  Rocket, 
  Camera,
  ShieldCheck,
  History,
  MessageSquareCode,
  Plus,
} from 'lucide-react';

type LucideIconProps = Omit<React.SVGProps<SVGSVGElement>, 'title'> & {
  title?: string;
  className?: string;
  size?: number | string;
  strokeWidth?: number | string;
  color?: string;
};

const IconWrapper: React.FC<
  { Icon: React.ElementType } & LucideIconProps
> = ({ Icon, title, className, ...restProps }) => (
  <Icon {...restProps} className={className}>
    {title && <title>{title}</title>}
  </Icon>
);

export const UploadIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Upload} {...props} />;
export const SpinnerIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Loader2} {...props} className={`animate-spin ${props.className || ''}`} />;
export const AppIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Image} {...props} />;
export const BoxIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Eye} {...props} />;
export const FireIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Flame} {...props} />;
export const WarningIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={AlertTriangle} {...props} />;
export const GithubIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Github} {...props} />;
export const ChartBarIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={BarChart} {...props} />;
export const ChartPieIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={PieChart} {...props} />;
export const EditIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Edit} {...props} />;
export const CloseIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={X} {...props} />;
export const TagIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Tag} {...props} />;
export const StoreIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Store} {...props} />;
export const SearchIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Search} {...props} />;
export const Bars3Icon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Menu} {...props} />;
export const HomeIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Home} {...props} />;
export const CalendarDaysIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={CalendarDays} {...props} />;
export const UserCircleIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={UserCircle} {...props} />;
export const CircleStackIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Layers} {...props} />;
export const UsersIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Users} {...props} />;
export const FolderIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Folder} {...props} />;
export const ChevronRightIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={ChevronRight} {...props} />;
export const ChevronLeftIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={ChevronLeft} {...props} />;
export const ChevronDownIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={ChevronDown} {...props} />;
export const BuildingStorefrontIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Store} {...props} />;
export const ArrowDownTrayIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Download} {...props} />;
export const DocumentChartBarIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={FileBarChart} {...props} />;
export const MapIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Map} {...props} />;
export const ClockIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Clock} {...props} />;
export const AdjustmentsHorizontalIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={SlidersHorizontal} {...props} />;
export const ArrowUpIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={ArrowUp} {...props} />;
export const ArrowDownIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={ArrowDown} {...props} />;
export const TrashIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Trash2} {...props} />;
export const KeyIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Key} {...props} />;
export const DocumentDuplicateIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={ClipboardCopy} {...props} />;
export const ArchiveBoxIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Archive} {...props} />;
export const SaveIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Save} {...props} />;
export const FolderOpenIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={FolderOpen} {...props} />;
export const DocumentTextIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={FileText} {...props} />;
export const RocketLaunchIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Rocket} {...props} />;
export const CameraIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Camera} {...props} />;
export const CpuChipIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Cpu} {...props} />;
export const TableCellsIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Table} {...props} />;

export const LightBulbIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Lightbulb} {...props} />;
export const MagnifyingGlassIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Search} {...props} />; 
export const ArrowLeftIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={ArrowLeft} {...props} />;
export const MagicWandIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Sparkles} {...props} />;
export const SparklesIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Sparkles} {...props} />;
export const ShieldExclamationIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={ShieldAlert} {...props} />;
export const ShieldCheckIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={ShieldCheck} {...props} />;
export const BookOpenIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={BookOpen} {...props} />;
export const ClipboardDocumentListIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={ClipboardList} {...props} />;
export const CheckCircleIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={CircleCheck} {...props} />;
export const XCircleIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={CircleX} {...props} />;
export const FunnelIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Filter} {...props} />;
export const CalculatorIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Calculator} {...props} />;
export const ArrowPathIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={RotateCw} {...props} />;
export const HistoryIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={History} {...props} />;
export const MessageSquareCodeIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={MessageSquareCode} {...props} />;

// FIX: Added PlusIcon export to resolve error in ListingPanel.tsx
export const PlusIcon: React.FC<LucideIconProps> = (props) => <IconWrapper Icon={Plus} {...props} />;

// Salesapp Vision Logo Components
export const VisionEyeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 100 60" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M50 10C30 10 10 30 10 30C10 30 30 50 50 50C70 50 90 30 90 30C90 30 70 10 50 10Z" fill="none" stroke="currentColor" strokeWidth="6" />
    <mask id="split-mask">
      <rect x="0" y="0" width="50" height="60" fill="white" />
    </mask>
    <mask id="split-mask-2">
      <rect x="50" y="0" width="50" height="60" fill="white" />
    </mask>
    <g mask="url(#split-mask)">
      <path d="M50 10C30 10 10 30 10 30C10 30 30 50 50 50L50 10Z" fill="#374151" />
      <circle cx="50" cy="30" r="16" fill="white" />
      <circle cx="50" cy="30" r="10" fill="#374151" />
    </g>
    <g mask="url(#split-mask-2)">
      <path d="M50 10C70 10 90 30 90 30C90 30 70 50 50 50L50 10Z" fill="#84cc16" />
      <circle cx="50" cy="30" r="16" fill="white" />
      <circle cx="50" cy="30" r="10" fill="#84cc16" />
    </g>
    <circle cx="46" cy="26" r="4" fill="white" />
  </svg>
);

export const SalesappVisionBrand: React.FC<{ className?: string, hideText?: boolean }> = ({ className = "h-8", hideText }) => (
  <div className={`flex items-center gap-3 ${className}`}>
    <VisionEyeIcon className="h-full" />
    {!hideText && (
      <span className="font-bold text-lg tracking-tight whitespace-nowrap">
        <span className="text-gray-700 dark:text-zinc-300">Salesapp</span>
        <span className="text-lime-600">Vision</span>
      </span>
    )}
  </div>
);
