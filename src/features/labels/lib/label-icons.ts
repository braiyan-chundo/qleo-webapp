import {
  Anchor,
  Bed,
  Bell,
  Bookmark,
  Briefcase,
  Building2,
  Calendar,
  Camera,
  Car,
  CheckCircle2,
  Clock,
  Coffee,
  Compass,
  CreditCard,
  File,
  FileText,
  Flag,
  Gift,
  Globe,
  Heart,
  Home,
  Hotel,
  Key,
  Luggage,
  Mail,
  Map,
  MapPin,
  Mountain,
  Music,
  Package,
  Phone,
  Plane,
  Ship,
  ShoppingBag,
  Star,
  Sun,
  Tag,
  Ticket,
  TrainFront,
  TreePalm,
  TriangleAlert,
  Umbrella,
  Users,
  Utensils,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

/**
 * Set **curado** de iconos para las etiquetas (QL-146). El `Label.icon` guardado es una
 * **clave** (string) que se resuelve aquí a un componente de lucide-react (`resolveLabelIcon`).
 * No se hace import dinámico arbitrario: solo estas claves conocidas se renderizan; cualquier
 * otra cae al icono genérico `tag`. Sesgado a viajes/MICE, el vertical del producto.
 */
export interface LabelIconOption {
  /** Clave estable persistida en `Label.icon`. */
  key: string;
  /** Nombre accesible (tooltip / aria-label del picker). */
  label: string;
  Icon: LucideIcon;
}

export const LABEL_ICONS: readonly LabelIconOption[] = [
  { key: 'tag', label: 'Etiqueta', Icon: Tag },
  { key: 'plane', label: 'Vuelo', Icon: Plane },
  { key: 'hotel', label: 'Hotel', Icon: Hotel },
  { key: 'bed', label: 'Alojamiento', Icon: Bed },
  { key: 'map-pin', label: 'Ubicación', Icon: MapPin },
  { key: 'map', label: 'Mapa', Icon: Map },
  { key: 'globe', label: 'Destino', Icon: Globe },
  { key: 'compass', label: 'Brújula', Icon: Compass },
  { key: 'luggage', label: 'Equipaje', Icon: Luggage },
  { key: 'briefcase', label: 'Negocio', Icon: Briefcase },
  { key: 'ticket', label: 'Ticket', Icon: Ticket },
  { key: 'car', label: 'Traslado', Icon: Car },
  { key: 'train', label: 'Tren', Icon: TrainFront },
  { key: 'ship', label: 'Crucero', Icon: Ship },
  { key: 'anchor', label: 'Puerto', Icon: Anchor },
  { key: 'palm-tree', label: 'Playa', Icon: TreePalm },
  { key: 'mountain', label: 'Montaña', Icon: Mountain },
  { key: 'sun', label: 'Clima', Icon: Sun },
  { key: 'umbrella', label: 'Sombrilla', Icon: Umbrella },
  { key: 'utensils', label: 'Comida', Icon: Utensils },
  { key: 'coffee', label: 'Café', Icon: Coffee },
  { key: 'camera', label: 'Fotos', Icon: Camera },
  { key: 'gift', label: 'Regalo', Icon: Gift },
  { key: 'shopping-bag', label: 'Compras', Icon: ShoppingBag },
  { key: 'music', label: 'Música', Icon: Music },
  { key: 'star', label: 'Destacado', Icon: Star },
  { key: 'heart', label: 'Favorito', Icon: Heart },
  { key: 'bookmark', label: 'Marcador', Icon: Bookmark },
  { key: 'flag', label: 'Bandera', Icon: Flag },
  { key: 'bell', label: 'Aviso', Icon: Bell },
  { key: 'check-circle', label: 'Confirmado', Icon: CheckCircle2 },
  { key: 'alert-triangle', label: 'Atención', Icon: TriangleAlert },
  { key: 'clock', label: 'Horario', Icon: Clock },
  { key: 'calendar', label: 'Fecha', Icon: Calendar },
  { key: 'users', label: 'Grupo', Icon: Users },
  { key: 'phone', label: 'Teléfono', Icon: Phone },
  { key: 'mail', label: 'Correo', Icon: Mail },
  { key: 'file', label: 'Documento', Icon: File },
  { key: 'file-text', label: 'Nota', Icon: FileText },
  { key: 'credit-card', label: 'Pago', Icon: CreditCard },
  { key: 'wallet', label: 'Presupuesto', Icon: Wallet },
  { key: 'package', label: 'Paquete', Icon: Package },
  { key: 'building', label: 'Empresa', Icon: Building2 },
  { key: 'home', label: 'Inicio', Icon: Home },
  { key: 'key', label: 'Acceso', Icon: Key },
] as const;

/** Índice clave→componente para resolución O(1). */
const ICON_BY_KEY: Record<string, LucideIcon> = Object.fromEntries(
  LABEL_ICONS.map((option) => [option.key, option.Icon]),
);

/**
 * Resuelve una clave de icono a su componente de lucide. Si la clave es desconocida (o falta),
 * devuelve el icono genérico `Tag` — nunca lanza ni deja un hueco en la UI (§3.38).
 */
export function resolveLabelIcon(key: string | null | undefined): LucideIcon {
  return (key && ICON_BY_KEY[key]) || Tag;
}
